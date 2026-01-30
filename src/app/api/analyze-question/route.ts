import { NextRequest, NextResponse } from 'next/server';
import { analyzeQuestion } from '@/services/question-grader';
import { z } from 'zod';
import { logger } from '@/services/logger';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Question grading should be fast (using gpt-4o-mini)

const AnalyzeQuestionSchema = z.object({
  question: z.string().min(10, 'Question must be at least 10 characters'),
});

/**
 * POST /api/analyze-question
 * Analyzes a question's quality and suitability for consensus tracking
 *
 * This is the "Question Sandbox" feature - it grades questions BEFORE
 * querying expensive models, saving costs and educating users.
 */
export async function POST(request: NextRequest) {
  try {
    // Public endpoint with rate limiting (no auth required)
    const rateLimit = enforceRateLimit(request, 'api:analyze-question');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many analysis requests. Please try later.' },
        {
          status: 429,
          headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() }
        }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = AnalyzeQuestionSchema.parse(body);
    const { question } = validatedData;

    logger.info('Question analysis request', { preview: question.slice(0, 80) });

    // Analyze the question using GPT-4o-mini (fast and cheap)
    const analysis = await analyzeQuestion(question);

    logger.info('Question analysis complete', {
      score: analysis.score,
      grade: analysis.grade,
      category: analysis.category,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    logger.error('Question analysis error', error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: error.errors.map((e) => e.message).join(', '),
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to analyze question',
        details: process.env.NODE_ENV === 'development' ? errorMessage : 'Please try again later.',
      },
      { status: 500 }
    );
  }
}
