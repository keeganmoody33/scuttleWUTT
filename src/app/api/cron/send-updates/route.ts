import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { lte, eq } from 'drizzle-orm';
import { answerQuestion, formatAnswerAsHTML } from '@/services/question-answering';
import { sendSMSUpdate } from '@/services/sms';
import { Resend } from 'resend';
import {
  createSnapshot,
  getLatestSnapshot,
  compareSnapshots,
  formatDiffAsHTML,
  formatDiffAsText,
  hasSignificantChanges,
} from '@/services/snapshots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Running subscription update cron job...');

    // Get all active AND VERIFIED subscriptions that are due for an update
    const dueSubscriptions = await db.query.questionSubscriptions.findMany({
      where: (subs, { and, lte, eq }) =>
        and(
          eq(subs.active, true),
          eq(subs.verified, true), // ONLY send to verified subscriptions
          lte(subs.nextSendAt, new Date())
        ),
      limit: 100, // Process 100 at a time
    });

    console.log(`Found ${dueSubscriptions.length} subscriptions due for update`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const subscription of dueSubscriptions) {
      try {
        console.log(`Processing subscription ${subscription.id} for: ${subscription.email || subscription.phone}`);

        // Get the latest snapshot for this question (to compare changes)
        const latestSnapshot = await getLatestSnapshot(subscription.questionId);

        // Re-generate answer for the question
        const answer = await answerQuestion(subscription.question);

        // Create a new snapshot
        const snapshotId = await createSnapshot(
          subscription.questionId,
          subscription.question,
          answer,
          'claude-sonnet-4-5'
        );

        // Compare with previous snapshot to detect changes
        let diff = null;
        let hasChanges = true; // Send first update always

        if (latestSnapshot) {
          diff = compareSnapshots(latestSnapshot, { answer });
          hasChanges = hasSignificantChanges(diff);

          if (!hasChanges) {
            console.log(`No significant changes for ${subscription.questionId}, skipping send`);

            // Still update next send time even if we skip
            const nextSendAt = new Date(
              Date.now() + subscription.frequencyDays * 24 * 60 * 60 * 1000
            );

            await db
              .update(questionSubscriptions)
              .set({
                lastSentAt: new Date(),
                nextSendAt,
              })
              .where(eq(questionSubscriptions.id, subscription.id));

            results.processed++;
            continue; // Skip to next subscription
          }
        }

        console.log(`Significant changes detected, sending update...`);

        // Send based on delivery method
        const deliveryMethod = subscription.deliveryMethod || 'email';

        if (deliveryMethod === 'email' || deliveryMethod === 'both') {
          if (subscription.email) {
            // Generate email HTML with changes highlighted
            let html = formatAnswerAsHTML(answer, subscription.question);

            // If there's a diff, prepend the "What Changed" section
            if (diff && latestSnapshot) {
              const changesSummary = `
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1f2937;">📊 What Changed Since Last Update</h2>
                  ${formatDiffAsHTML(diff)}
                </div>
              `;
              html = changesSummary + html;
            }

            // Send email
            await resend.emails.send({
              from: 'Scuttle What <updates@scuttlewhat.com>',
              to: subscription.email,
              subject: `Scuttle What Update: ${subscription.question}`,
              html,
            });

            console.log(`✓ Sent email to ${subscription.email}`);
          }
        }

        if (deliveryMethod === 'sms' || deliveryMethod === 'both') {
          if (subscription.phone) {
            // For SMS, include a brief changes summary if available
            let smsMessage = '';

            if (diff) {
              const diffText = formatDiffAsText(diff);
              smsMessage = `Changes:\n${diffText}\n\n`;
            }

            // Send SMS with changes
            await sendSMSUpdate(subscription.phone, subscription.question, answer, smsMessage);

            console.log(`✓ Sent SMS to ${subscription.phone}`);
          }
        }

        // Update subscription
        const nextSendAt = new Date(
          Date.now() + subscription.frequencyDays * 24 * 60 * 60 * 1000
        );

        await db
          .update(questionSubscriptions)
          .set({
            lastSentAt: new Date(),
            nextSendAt,
          })
          .where(eq(questionSubscriptions.id, subscription.id));

        console.log(`✓ Updated subscription, next update: ${nextSendAt}`);

        results.sent++;
      } catch (error) {
        const errorMsg = `Failed to process subscription ${subscription.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
        results.failed++;
      }

      results.processed++;
    }

    console.log('Cron job completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
