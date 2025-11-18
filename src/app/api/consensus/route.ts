import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion } from '@/services/question-answering';
import { db, questions } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { callMultipleModels, type LLMModel, getModelMetadata } from '@/services/llm';
import { compareModelResponses, getConsensusRecommendations } from '@/services/model-comparison';
import { createSnapshot } from '@/services/snapshots';
import { getDemandSignal } from '@/services/demand-proxy';
import { logger } from '@/services/logger';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for multi-model consensus

const ConsensusSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
});

/**
 * Door A: The "Executive Consensus Tool"
 *
 * This is our GTM lead magnet. It's simple, fast, and trustworthy.
 *
 * How it works:
 * 1. User asks a question
 * 2. We run it across 5-7 curated models in parallel (hidden from user)
 * 3. We use our comparison engine to find consensus tools
 * 4. We return ONE answer with a "Trust Badge" showing the consensus score
 *
 * The complexity (multi-model comparison) is HIDDEN.
 * The value (unbiased, consensus answer) is SHOWN.
 */
export async function POST(request: NextRequest) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:consensus');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many consensus requests. Please try later.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = ConsensusSchema.parse(body);
    const { question } = validatedData;

    logger.info('Consensus API request received', { preview: question.slice(0, 80) });

    // Step 1: Get market intent signal (for context, not shown to basic user)
    const demandSignal = await getDemandSignal([question]);

    // Step 2: Run across our curated "Consensus Models"
    // Using 2 high-quality models (DeepSeek temporarily disabled due to API balance)
    const consensusModels: LLMModel[] = [
      'claude-sonnet-4-5', // Anthropic - highest quality
      'gpt-4o', // OpenAI - fast and reliable
      // 'deepseek-chat', // DeepSeek - disabled (insufficient balance)
    ];

    logger.info('Running consensus comparison', { modelCount: consensusModels.length });

    // Call all models in parallel
    const responses = await Promise.all(
      consensusModels.map(async (model) => {
        const metadata = getModelMetadata(model);

        try {
          const answer = await answerQuestion(question, model);

          return {
            model,
            answer,
            modelName: metadata.name,
            provider: metadata.provider,
            success: true,
          };
        } catch (error) {
          logger.warn('Consensus model call failed', { model, error });
          return {
            model,
            answer: null,
            modelName: metadata.name,
            provider: metadata.provider,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Filter successful responses
    const successfulResponses = responses.filter(
      (r) => r.success && r.answer
    ) as Array<{
      model: LLMModel;
      answer: any;
      modelName: string;
      provider: string;
    }>;

    if (successfulResponses.length < 2) {
      // Fallback to single model if multi-model fails
      logger.warn('Consensus fallback triggered', { successfulResponses: successfulResponses.length });

      const fallbackAnswer = await answerQuestion(question, 'claude-sonnet-4-5');

      const questionId = generateId('q');
      await db.insert(questions).values({
        id: questionId,
        question,
        answer: fallbackAnswer,
        askedAt: new Date(),
      });

      // Create snapshot
      await createSnapshot(questionId, question, fallbackAnswer, 'claude-sonnet-4-5');

      return NextResponse.json({
        questionId,
        question,
        answer: fallbackAnswer,
        trustBadge: {
          modelsUsed: 1,
          modelsQueried: consensusModels.length, // We attempted to query all models, only 1 succeeded
          consensusScore: 100, // Single model = 100% consensus with itself
          diversityScore: 0,
          message: 'Powered by Claude Sonnet 4.5',
          breakdown: {
            unanimous: fallbackAnswer.tools?.length || 0, // Single model = all tools are unanimous
            majority: 0,
            unique: 0,
          },
        },
      });
    }

    // Step 3: Run comparison analysis
    const comparison = compareModelResponses(successfulResponses);

    // Step 4: Build the "Consensus Answer"
    // We only show tools that have majority consensus (50%+ of models)
    const consensusTools = comparison.tools
      .filter((t) => t.consensus === 'unanimous' || t.consensus === 'majority')
      .map((t) => t.tool);

    // If no consensus, show top tools by mention count
    const finalTools =
      consensusTools.length > 0
        ? consensusTools.slice(0, 5)
        : comparison.tools.slice(0, 5).map((t) => t.tool);

    const consensusAnswer = {
      tools: finalTools,
      generatedAt: new Date().toISOString(),
    };

    // Step 5: Store the consensus answer
    const questionId = generateId('q');
    await db.insert(questions).values({
      id: questionId,
      question,
      answer: consensusAnswer,
      askedAt: new Date(),
    });

    // Create snapshot with special model tag for consensus
    await createSnapshot(questionId, question, consensusAnswer, 'consensus-v1');

    logger.info('Consensus answer generated', {
      questionId,
      modelsUsed: successfulResponses.length,
    });

    // Step 6: Return the simplified answer with Trust Badge
    return NextResponse.json({
      questionId,
      question,
      answer: consensusAnswer,

      // The "Trust Badge" - This is what makes us trustworthy
      trustBadge: {
        modelsUsed: successfulResponses.length,
        modelsQueried: consensusModels.length,
        consensusScore: comparison.biasMetrics.consensusScore,
        diversityScore: comparison.biasMetrics.diversityScore,
        message: `Cross-referenced across ${successfulResponses.length} leading AI models`,
        breakdown: {
          unanimous: comparison.overlap.unanimous.length, // All models agree
          majority: comparison.overlap.majority.length, // Most models agree
          unique: comparison.overlap.unique.length, // Only 1 model found
        },
      },

      // Market signals (for transparency)
      signals: {
        marketIntent: {
          score: demandSignal.intentScore,
          trend: demandSignal.trend,
          source: demandSignal.source,
        },
        marketSaturation: {
          score: Math.round(comparison.biasMetrics.consensusScore), // High consensus = high saturation
          competitorsFound: comparison.tools.length,
        },
      },

      // Link to full methodology (for power users who want to dig deeper)
      methodologyUrl: `/question/${questionId}/compare`,
    });
  } catch (error) {
    logger.error('Consensus API error', error as Error);

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
        error: 'Failed to generate consensus',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}
