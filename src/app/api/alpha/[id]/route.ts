import { NextRequest, NextResponse } from 'next/server';
import { db, opportunityTrackers } from '@/db';
import { eq } from 'drizzle-orm';
import { getDemandSignal, calculateOpportunityScore } from '@/services/demand-proxy';
import { answerQuestion } from '@/services/question-answering';
import { compareModelResponses } from '@/services/model-comparison';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logger } from '@/services/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * PUT /api/alpha/[id]
 * Refresh/update an opportunity tracker
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:alpha:update');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many refresh attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const { id } = params;

    // Get the existing tracker
    const existing = await db
      .select()
      .from(opportunityTrackers)
      .where(eq(opportunityTrackers.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Tracker not found' },
        { status: 404 }
      );
    }

    const tracker = existing[0];

    logger.info('Refreshing opportunity tracker', { trackerId: id, ideaName: tracker.ideaName });

    // Re-run the analysis
    // Step 1: Get updated demand signal
    const demandSignal = await getDemandSignal(tracker.keywords as string[]);

    // Step 2: Get updated saturation signal
    const competitorQuestion = `What are the top SaaS tools for: ${(tracker.keywords as string[]).join(', ')}`;

    const models: Array<'claude-sonnet-4-5' | 'gpt-4o' | 'deepseek-chat'> = [
      'claude-sonnet-4-5',
      'gpt-4o',
      'deepseek-chat',
    ];

    const responses = await Promise.all(
      models.map(async (model) => {
        try {
          const answer = await answerQuestion(competitorQuestion, model);
          return {
            model,
            answer,
            modelName: model,
            provider: model.includes('claude') ? 'Anthropic' : model.includes('gpt') ? 'OpenAI' : 'DeepSeek',
            success: true,
          };
        } catch (error) {
          logger.warn('Model call failed during tracker refresh', { model, trackerId: id, error });
          return {
            model,
            answer: null,
            success: false,
          };
        }
      })
    );

    const successfulResponses = responses.filter(
      (r) => r.success && r.answer
    ) as Array<{
      model: 'claude-sonnet-4-5' | 'gpt-4o' | 'deepseek-chat';
      answer: any;
      modelName: string;
      provider: string;
    }>;

    let saturationScore = tracker.saturationScore || 50;
    let competitiveConsensus = tracker.competitiveConsensus || 0;

    if (successfulResponses.length >= 2) {
      const comparison = compareModelResponses(successfulResponses);
      saturationScore = comparison.biasMetrics.consensusScore;
      competitiveConsensus = comparison.tools.length;
    }

    // Step 3: Recalculate opportunity window
    const opportunityWindow = calculateOpportunityScore(
      demandSignal.intentScore,
      saturationScore
    );

    // Step 4: Update the tracker
    const now = new Date();
    const nextCheck = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await db
      .update(opportunityTrackers)
      .set({
        intentScore: demandSignal.intentScore,
        intentTrend: demandSignal.trend,
        saturationScore,
        competitiveConsensus,
        opportunityScore: opportunityWindow.score,
        windowStatus: opportunityWindow.status,
        lastCheckedAt: now,
        nextCheckAt: nextCheck,
        updatedAt: now,
      })
      .where(eq(opportunityTrackers.id, id));

    logger.info('Tracker updated successfully', { trackerId: id, status: opportunityWindow.status, score: opportunityWindow.score });

    // Return updated tracker
    const updated = await db
      .select()
      .from(opportunityTrackers)
      .where(eq(opportunityTrackers.id, id))
      .limit(1);

    return NextResponse.json({
      tracker: updated[0],
      message: 'Tracker refreshed successfully',
    });
  } catch (error) {
    logger.error('Error updating tracker', error);

    return NextResponse.json(
      {
        error: 'Failed to update tracker',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alpha/[id]
 * Delete an opportunity tracker
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:alpha:delete');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many delete attempts.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const { id } = params;

    // Check if tracker exists
    const existing = await db
      .select()
      .from(opportunityTrackers)
      .where(eq(opportunityTrackers.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Tracker not found' },
        { status: 404 }
      );
    }

    // Delete the tracker
    await db
      .delete(opportunityTrackers)
      .where(eq(opportunityTrackers.id, id));

    logger.info('Tracker deleted successfully', { trackerId: id });

    return NextResponse.json({
      message: 'Tracker deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting tracker', error);

    return NextResponse.json(
      {
        error: 'Failed to delete tracker',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}
