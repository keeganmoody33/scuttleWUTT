import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  questionId: z.string().min(1, 'Question ID is required'),
  question: z.string().min(5, 'Question must be at least 5 characters'),
  frequencyDays: z.number().int().min(1).max(90, 'Frequency must be between 1 and 90 days'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = SubscribeSchema.parse(body);

    const { email, questionId, question, frequencyDays } = validatedData;

    console.log(`Processing subscription: ${email} for question "${question}" (every ${frequencyDays} days)`);

    // Check if this email is already subscribed to this question
    const existing = await db.query.questionSubscriptions.findFirst({
      where: (subs, { and, eq }) =>
        and(eq(subs.email, email), eq(subs.questionId, questionId), eq(subs.active, true)),
    });

    if (existing) {
      // Update existing subscription
      await db
        .update(questionSubscriptions)
        .set({
          frequencyDays,
          nextSendAt: new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000),
        })
        .where(eq(questionSubscriptions.id, existing.id));

      console.log(`✓ Updated existing subscription: ${existing.id}`);

      return NextResponse.json({
        message: 'Subscription updated successfully',
        subscriptionId: existing.id,
      });
    }

    // Create new subscription
    const subscriptionId = generateId('sub');
    const nextSendAt = new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000);

    await db.insert(questionSubscriptions).values({
      id: subscriptionId,
      email,
      questionId,
      question,
      frequencyDays,
      nextSendAt,
      active: true,
      createdAt: new Date(),
    });

    console.log(`✓ Created subscription: ${subscriptionId}`);

    return NextResponse.json({
      message: 'Subscription created successfully',
      subscriptionId,
      nextUpdateDate: nextSendAt,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);

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
        error: 'Failed to create subscription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Unsubscribe endpoint
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    await db
      .update(questionSubscriptions)
      .set({ active: false })
      .where(eq(questionSubscriptions.id, subscriptionId));

    console.log(`✓ Unsubscribed: ${subscriptionId}`);

    return NextResponse.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);

    return NextResponse.json(
      {
        error: 'Failed to unsubscribe',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
