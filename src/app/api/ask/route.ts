import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion } from '@/services/question-answering';
import { db, questions } from '@/db';
import { generateId } from '@/lib/utils';
import { createSnapshot } from '@/services/snapshots';
import { logger } from '@/services/logger';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:ask');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      );
    }

    if (question.length < 5 || question.length > 500) {
      return NextResponse.json(
        { error: 'Question must be between 5 and 500 characters' },
        { status: 400 }
      );
    }

    logger.info('Processing ask request', { preview: question.slice(0, 80) });

    const answer = await answerQuestion(question);

    const questionId = generateId('q');
    await db.insert(questions).values({
      id: questionId,
      question,
      answer,
      askedAt: new Date(),
    });

    await createSnapshot(questionId, question, answer, 'claude-sonnet-4-5');

    logger.info('Question answered and stored', { questionId });

    return NextResponse.json({
      questionId,
      question,
      answer,
    });
  } catch (error) {
    logger.error('Error processing ask request', error);
    return NextResponse.json(
      {
        error: 'Failed to process question',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}
