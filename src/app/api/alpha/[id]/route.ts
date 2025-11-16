import { NextRequest, NextResponse } from 'next/server';
import { db, opportunityTrackers } from '@/db';
import { eq } from 'drizzle-orm';
import { getDemandSignal, calculateOpportunityScore } from '@/services/demand-proxy';
import { answerQuestion } from '@/services/question-answering';
import { compareModelResponses } from '@/services/model-comparison';

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

    console.log(`[Alpha API] Refreshing tracker ${id}: "${tracker.ideaName}"`);

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
          console.error(`[Alpha API] Error with ${model}:`, error);
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

    console.log(`[Alpha API] Updated tracker ${id}: ${opportunityWindow.status} (${opportunityWindow.score}/100)`);

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
    console.error('[Alpha API] Error updating tracker:', error);

    return NextResponse.json(
      {
        error: 'Failed to update tracker',
        details: error instanceof Error ? error.message : 'Unknown error',
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

    console.log(`[Alpha API] Deleted tracker ${id}`);

    return NextResponse.json({
      message: 'Tracker deleted successfully',
    });
  } catch (error) {
    console.error('[Alpha API] Error deleting tracker:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete tracker',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
