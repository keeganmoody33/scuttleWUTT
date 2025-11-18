import { NextRequest, NextResponse } from 'next/server';
import { db, opportunityTrackers } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { getDemandSignal, calculateOpportunityScore } from '@/services/demand-proxy';
import { callMultipleModels } from '@/services/llm';
import { compareModelResponses } from '@/services/model-comparison';
import { answerQuestion } from '@/services/question-answering';
import { eq } from 'drizzle-orm';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logger } from '@/services/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CreateTrackerSchema = z.object({
  ideaName: z.string().min(3, 'Idea name must be at least 3 characters'),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required'),
  userId: z.string().optional(), // For now, allow anonymous tracking
});

/**
 * GET /api/alpha
 * List all opportunity trackers for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:alpha:get');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many tracker reads. Please slow down.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    // TODO: Add authentication and filter by user
    // For MVP, return all trackers
    const allTrackers = await db
      .select()
      .from(opportunityTrackers)
      .orderBy(opportunityTrackers.createdAt);

    return NextResponse.json({
      trackers: allTrackers,
    });
  } catch (error) {
    logger.error('Error fetching trackers', error as Error);

    return NextResponse.json(
      {
        error: 'Failed to fetch trackers',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alpha
 * Create a new opportunity tracker
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:alpha:post');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many tracker creations. Please wait.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();
    const validatedData = CreateTrackerSchema.parse(body);

    const { ideaName, keywords } = validatedData;

    logger.info('Creating opportunity tracker', { ideaName, keywordCount: keywords.length });

    // Step 1: Get Market Intent signal
    const demandSignal = await getDemandSignal(keywords);

    // Step 2: Get Market Saturation signal (query LLMs about competitors)
    // Build a question for the LLMs
    const competitorQuestion = `What are the top SaaS tools for: ${keywords.join(', ')}`;

    // Use a subset of models for speed (3-4 models instead of 5)
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
          logger.warn('Model call failed during tracker creation', { model, error });
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

    let saturationScore = 50; // Default
    let competitiveConsensus = 0;

    if (successfulResponses.length >= 2) {
      const comparison = compareModelResponses(successfulResponses);
      saturationScore = comparison.biasMetrics.consensusScore;
      competitiveConsensus = comparison.tools.length;
    }

    // Step 3: Calculate Opportunity Window
    const opportunityWindow = calculateOpportunityScore(
      demandSignal.intentScore,
      saturationScore
    );

    // Step 4: Create the tracker
    const trackerId = generateId('opp');
    const now = new Date();
    const nextCheck = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    await db.insert(opportunityTrackers).values({
      id: trackerId,
      userId: validatedData.userId || 'anonymous', // TODO: Use real user ID
      ideaName,
      keywords,
      intentScore: demandSignal.intentScore,
      intentTrend: demandSignal.trend,
      saturationScore,
      competitiveConsensus,
      opportunityScore: opportunityWindow.score,
      windowStatus: opportunityWindow.status,
      alertsEnabled: true,
      lastCheckedAt: now,
      nextCheckAt: nextCheck,
      createdAt: now,
      updatedAt: now,
    });

    logger.info('Tracker created successfully', { trackerId, status: opportunityWindow.status, score: opportunityWindow.score });

    // Return the created tracker
    const tracker = await db
      .select()
      .from(opportunityTrackers)
      .where(eq(opportunityTrackers.id, trackerId))
      .limit(1);

    return NextResponse.json({
      tracker: tracker[0],
      message: `Tracker created! Window status: ${opportunityWindow.status}`,
    });
  } catch (error) {
    logger.error('Error creating tracker', error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: error.errors.map((e) => e.message).join(', '),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create tracker',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
