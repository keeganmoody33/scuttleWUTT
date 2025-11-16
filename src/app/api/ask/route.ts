import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion } from '@/services/question-answering';
import { db, questions } from '@/db';
import { generateId } from '@/lib/utils';
import { createSnapshot } from '@/services/snapshots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    console.log(`Processing question: "${question}"`);

    // Generate answer using Claude
    const answer = await answerQuestion(question);

    // Store question and answer in database
    const questionId = generateId('q');
    await db.insert(questions).values({
      id: questionId,
      question,
      answer,
      askedAt: new Date(),
    });

    console.log(`✓ Question answered and stored with ID: ${questionId}`);

    // Create initial snapshot
    await createSnapshot(questionId, question, answer, 'claude-sonnet-4-5');

    console.log(`✓ Created initial snapshot for question ${questionId}`);

    return NextResponse.json({
      questionId,
      question,
      answer,
    });
  } catch (error) {
    console.error('Error processing question:', error);

    return NextResponse.json(
      {
        error: 'Failed to process question',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
