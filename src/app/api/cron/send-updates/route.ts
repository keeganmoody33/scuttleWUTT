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
import { env } from '@/lib/env';
import { logger } from '@/services/logger';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resend = new Resend(env.RESEND_API_KEY);

export async function GET(request: NextRequest) {
  try {
    const rateLimit = enforceRateLimit(request, 'cron:send-updates');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Cron throttle in effect' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting send-updates cron job');

    const dueSubscriptions = await db.query.questionSubscriptions.findMany({
      where: (subs, { and, lte, eq }) =>
        and(eq(subs.active, true), eq(subs.verified, true), lte(subs.nextSendAt, new Date())),
      limit: 100,
    });

    logger.info('Found due subscriptions', { count: dueSubscriptions.length });

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const subscription of dueSubscriptions) {
      try {
        logger.debug('Processing subscription', { subscriptionId: subscription.id });

        const newAnswer = await answerQuestion(subscription.question);
        const newSnapshotId = await createSnapshot(
          subscription.questionId,
          subscription.question,
          newAnswer
        );

        let shouldSend = true;
        let changesSummary: string | undefined;
        let changesHtml: string | undefined;

        if (subscription.notifyOnChangeOnly) {
          const previousSnapshot = await getLatestSnapshot(subscription.questionId);

          if (previousSnapshot && previousSnapshot.id !== newSnapshotId) {
            const diff = compareSnapshots(previousSnapshot, newAnswer);
            const hasChanges = hasSignificantChanges(diff);

            if (!hasChanges) {
              shouldSend = false;
              logger.info('Skipping notification - no significant changes detected', {
                subscriptionId: subscription.id,
                notifyOnChangeOnly: true,
              });
            } else {
              changesSummary = `\n\n=== CHANGES DETECTED ===\n${formatDiffAsText(diff)}\n\n`;
              changesHtml = formatDiffAsHTML(diff);
              logger.info('Changes detected - sending notification', {
                subscriptionId: subscription.id,
                addedTools: diff.added.length,
                removedTools: diff.removed.length,
                movedTools: diff.moved.length,
              });
            }
          } else {
            logger.info('First snapshot - sending initial notification', {
              subscriptionId: subscription.id,
            });
          }
        } else {
          logger.debug('Always notify mode - sending update', {
            subscriptionId: subscription.id,
            notifyOnChangeOnly: false,
          });
        }

        if (shouldSend) {
          if (
            subscription.deliveryMethod === 'email' ||
            subscription.deliveryMethod === 'both'
          ) {
            if (!subscription.email) {
              throw new Error('Email required for email delivery');
            }

            let emailHtml = formatAnswerAsHTML(newAnswer, subscription.question);

            if (changesHtml) {
              emailHtml = emailHtml.replace(
                '<div style="max-width: 600px',
                `<div style="margin-bottom: 24px; padding: 16px; background: #fff4e6; border-left: 4px solid #f59e0b; border-radius: 4px;">
                  <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 16px;">📊 What Changed</h3>
                  ${changesHtml}
                </div>
                <div style="max-width: 600px`
              );
            }

            await resend.emails.send({
              from: 'Scuttle What <updates@scuttlewhat.com>',
              to: subscription.email,
              subject: changesHtml
                ? `Update: "${subscription.question}" - Changes detected`
                : `Update: "${subscription.question}"`,
              html: emailHtml,
            });

            logger.info('Sent email update', { email: subscription.email });
          }

          if (
            subscription.deliveryMethod === 'sms' ||
            subscription.deliveryMethod === 'both'
          ) {
            if (!subscription.phone) {
              throw new Error('Phone required for SMS delivery');
            }

            await sendSMSUpdate(
              subscription.phone,
              subscription.question,
              newAnswer,
              changesSummary
            );

            logger.info('Sent SMS update', { phone: subscription.phone });
          }

          sentCount++;
        } else {
          skippedCount++;
        }

        const nextSendAt = new Date(
          Date.now() + subscription.frequencyDays * 24 * 60 * 60 * 1000
        );

        await db
          .update(questionSubscriptions)
          .set({
            lastSentAt: shouldSend ? new Date() : subscription.lastSentAt,
            nextSendAt,
          })
          .where(eq(questionSubscriptions.id, subscription.id));

        logger.debug('Updated subscription', {
          subscriptionId: subscription.id,
          nextSendAt,
          sent: shouldSend,
        });
      } catch (err) {
        errorCount++;
        logger.error('Failed to process subscription', err, {
          subscriptionId: subscription.id,
        });
      }
    }

    logger.info('Send-updates cron job completed', {
      totalProcessed: dueSubscriptions.length,
      sent: sentCount,
      skipped: skippedCount,
      errors: errorCount,
    });

    return NextResponse.json({
      success: true,
      processed: dueSubscriptions.length,
      sent: sentCount,
      skipped: skippedCount,
      errors: errorCount,
    });
  } catch (error) {
    logger.error('Send-updates cron job failed', error);
    return NextResponse.json(
      { error: 'Failed to send updates', details: String(error) },
      { status: 500 }
    );
  }
}
