import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion, type QuestionAnswer } from '@/services/question-answering';
import { db, questions } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { callMultipleModels, type LLMModel, getModelMetadata } from '@/services/llm';
import { compareModelResponses, getConsensusRecommendations } from '@/services/model-comparison';
import { createSnapshot } from '@/services/snapshots';
import { getDemandSignal } from '@/services/demand-proxy';
import { logger } from '@/services/logger';
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
    // Public endpoint - no auth required (this is Door A, the lead magnet)
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
    // Wrap in try-catch so it doesn't break the flow if it fails
    let demandSignal;
    try {
      demandSignal = await getDemandSignal([question]);
    } catch (error) {
      logger.warn('Failed to get demand signal, continuing without it', { error });
      // Use a default signal if it fails
      demandSignal = {
        keywords: [question],
        intentScore: 50,
        trend: 'flat' as const,
        velocity: 0,
        source: 'manual' as const,
        lastUpdated: new Date(),
      };
    }

    // Step 2: Run across ALL available models (based on API keys)
    // Automatically includes all models that have API keys configured
    const consensusModels: LLMModel[] = [];

    // Anthropic Claude models (need ANTHROPIC_API_KEY)
    if (process.env.ANTHROPIC_API_KEY) {
      consensusModels.push('claude-sonnet-4-5'); // Latest and best
      consensusModels.push('claude-opus-4'); // Most capable
      consensusModels.push('claude-3-5-sonnet'); // Previous gen
      consensusModels.push('claude-3-5-haiku'); // Fast/cheap
      consensusModels.push('claude-3-opus'); // Legacy most capable
      consensusModels.push('claude-3-sonnet'); // Legacy balanced
      consensusModels.push('claude-3-haiku'); // Legacy fast
    }

    // OpenAI GPT models (need OPENAI_API_KEY)
    if (process.env.OPENAI_API_KEY) {
      consensusModels.push('gpt-4o'); // Latest flagship
      consensusModels.push('gpt-4o-mini'); // Fast and cheap
      consensusModels.push('gpt-4-turbo'); // Previous gen
      consensusModels.push('gpt-4'); // Original GPT-4
      consensusModels.push('gpt-3.5-turbo'); // Legacy fast
    }

    // DeepSeek models (need DEEPSEEK_API_KEY)
    if (process.env.DEEPSEEK_API_KEY) {
      consensusModels.push('deepseek-chat'); // Open weights reasoning
      consensusModels.push('deepseek-coder'); // Coding focused
    }

    // OpenRouter models (need OPENROUTER_API_KEY) - includes Llama, Mistral, etc.
    if (process.env.OPENROUTER_API_KEY) {
      consensusModels.push('llama-3.3-70b'); // Latest Llama
      consensusModels.push('llama-3.1-405b'); // Largest model (expensive but powerful)
      consensusModels.push('llama-3.1-70b'); // Stable Llama
      consensusModels.push('mistral-large'); // Mistral flagship
      consensusModels.push('mistral-medium'); // Balanced Mistral
      consensusModels.push('mistral-small'); // Fast Mistral
    }

    // Perplexity models (need PERPLEXITY_API_KEY) - web search enabled
    if (process.env.PERPLEXITY_API_KEY) {
      consensusModels.push('perplexity-sonar-pro'); // Best search
      consensusModels.push('perplexity-sonar'); // Fast search
    }

    // Note: Gemini models require Google AI SDK integration (coming soon)
    // if (process.env.GOOGLE_AI_API_KEY) {
    //   consensusModels.push('gemini-2.0-flash');
    //   consensusModels.push('gemini-1.5-pro');
    //   consensusModels.push('gemini-1.5-flash');
    // }

    if (consensusModels.length === 0) {
      logger.error('No LLM API keys configured');
      return NextResponse.json(
        {
          error: 'Service configuration error',
          details: 'No LLM API keys are configured. Please set at least one: ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, or PERPLEXITY_API_KEY.',
        },
        { status: 500 }
      );
    }

    logger.info('Consensus models selected', {
      count: consensusModels.length,
      models: consensusModels,
      providers: {
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        deepseek: !!process.env.DEEPSEEK_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY,
        perplexity: !!process.env.PERPLEXITY_API_KEY,
      }
    });

    logger.info('Running consensus comparison', { modelCount: consensusModels.length });

    // Get model metadata for UI display
    const modelMetadata = consensusModels.map((model) => {
      const meta = getModelMetadata(model);
      return {
        model,
        modelName: meta.name,
        provider: meta.provider,
      };
    });

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

    // Check if any response is factual (they should all be the same type)
    const firstResponse = successfulResponses[0];
    const isFactual = firstResponse?.answer?.answerType === 'factual';

    if (isFactual) {
      // For factual questions, just return the first answer (no need for consensus)
      const factualAnswer = firstResponse.answer;
      const questionId = generateId('q');
      
      try {
        // Store factual answer - database expects JSONB format
        await db.insert(questions).values({
          id: questionId,
          question,
          answer: factualAnswer as any, // JSONB accepts the full QuestionAnswer structure
          askedAt: new Date(),
        });

        await createSnapshot(questionId, question, factualAnswer, firstResponse.model);
      } catch (dbError) {
        logger.error('Database error storing factual answer', dbError as Error);
      }

      return NextResponse.json({
        questionId,
        question,
        answer: factualAnswer,
        // Model status for UI display
        modelStatus: modelMetadata.map((meta) => {
          const response = responses.find((r) => r.model === meta.model);
          return {
            model: meta.model,
            modelName: meta.modelName,
            provider: meta.provider,
            status: response?.success ? 'completed' : 'failed',
            error: response?.success ? undefined : response?.error,
          };
        }),
        trustBadge: {
          modelsUsed: successfulResponses.length,
          modelsQueried: consensusModels.length,
          consensusScore: 100,
          diversityScore: 0,
          message: `Answered by ${successfulResponses.length} AI model${successfulResponses.length > 1 ? 's' : ''}`,
          breakdown: {
            unanimous: 0,
            majority: 0,
            unique: 0,
          },
        },
      });
    }

    if (successfulResponses.length < 2) {
      // Fallback to single model if multi-model fails
      logger.warn('Consensus fallback triggered', { successfulResponses: successfulResponses.length });

      const fallbackAnswer = await answerQuestion(question, 'claude-sonnet-4-5');

      const questionId = generateId('q');

      // Wrap database operations in try-catch
      try {
        await db.insert(questions).values({
          id: questionId,
          question,
          answer: fallbackAnswer as any, // JSONB accepts the full QuestionAnswer structure
          askedAt: new Date(),
        });

        // Create snapshot
        await createSnapshot(questionId, question, fallbackAnswer, 'claude-sonnet-4-5');
      } catch (dbError) {
        logger.error('Database error in fallback path', dbError as Error);
        // Continue anyway - we can still return the answer
      }

      return NextResponse.json({
        questionId,
        question,
        answer: fallbackAnswer,
        // Model status for UI display
        modelStatus: modelMetadata.map((meta) => {
          const response = responses.find((r) => r.model === meta.model);
          return {
            model: meta.model,
            modelName: meta.modelName,
            provider: meta.provider,
            status: response?.success ? 'completed' : 'failed',
            error: response?.success ? undefined : response?.error,
          };
        }),
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
    // Show top 5 tools by mention count across ALL models (executives want to see all options)
    // Sort by mention count (most recommended first), then take top 5
    const sortedTools = comparison.tools.sort((a, b) => b.mentionCount - a.mentionCount);
    const finalTools = sortedTools.slice(0, 5).map((t) => t.tool);

    const consensusAnswer: QuestionAnswer = {
      tools: finalTools,
      answerType: 'tools',
      generatedAt: new Date().toISOString(),
    };

    // Step 5: Store the consensus answer
    const questionId = generateId('q');

    // Wrap database operations in try-catch
    try {
      await db.insert(questions).values({
        id: questionId,
        question,
        answer: consensusAnswer as any, // JSONB accepts the full QuestionAnswer structure
        askedAt: new Date(),
      });

      // Create snapshot with special model tag for consensus
      await createSnapshot(questionId, question, consensusAnswer, 'consensus-v1');
    } catch (dbError) {
      logger.error('Database error storing consensus answer', dbError as Error);
      // Continue anyway - we can still return the answer even if DB save fails
    }

    logger.info('Consensus answer generated', {
      questionId,
      modelsUsed: successfulResponses.length,
    });

    // Step 6: Return the simplified answer with Trust Badge
    return NextResponse.json({
      questionId,
      question,
      answer: consensusAnswer,

      // Model status for UI display
      modelStatus: modelMetadata.map((meta) => {
        const response = responses.find((r) => r.model === meta.model);
        return {
          model: meta.model,
          modelName: meta.modelName,
          provider: meta.provider,
          status: response?.success ? 'completed' : 'failed',
          error: response?.success ? undefined : response?.error,
        };
      }),

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

    // Return more detailed error information in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Failed to generate consensus',
        details: process.env.NODE_ENV === 'development' ? errorMessage : 'Please try again later.',
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}
