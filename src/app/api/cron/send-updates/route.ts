import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { lte, eq } from 'drizzle-orm';
import { answerQuestion, formatAnswerAsHTML } from '@/services/question-answering';
import { Resend } from 'resend';

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

    // Get all active subscriptions that are due for an update
    const dueSubscriptions = await db.query.questionSubscriptions.findMany({
      where: (subs, { and, lte, eq }) =>
        and(eq(subs.active, true), lte(subs.nextSendAt, new Date())),
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
        console.log(`Processing subscription ${subscription.id} for: ${subscription.email}`);

        // Re-generate answer for the question
        const answer = await answerQuestion(subscription.question);

        // Generate email HTML
        const html = formatAnswerAsHTML(answer, subscription.question);

        // Send email
        await resend.emails.send({
          from: 'Scuttle What <updates@scuttlewhat.com>',
          to: subscription.email,
          subject: `Scuttle What Update: ${subscription.question}`,
          html,
        });

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

        console.log(`✓ Sent update to ${subscription.email}, next update: ${nextSendAt}`);

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
