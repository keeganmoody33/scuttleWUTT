import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SubscribeSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Invalid phone number').optional(),
  deliveryMethod: z.enum(['email', 'sms', 'both']).default('email'),
  questionId: z.string().min(1, 'Question ID is required'),
  question: z.string().min(5, 'Question must be at least 5 characters'),
  frequencyDays: z.number().int().min(1).max(90, 'Frequency must be between 1 and 90 days'),
}).refine(
  (data) => {
    // Validate based on delivery method
    if (data.deliveryMethod === 'email' || data.deliveryMethod === 'both') {
      return !!data.email;
    }
    if (data.deliveryMethod === 'sms' || data.deliveryMethod === 'both') {
      return !!data.phone;
    }
    return true;
  },
  {
    message: 'Email required for email delivery, phone required for SMS delivery',
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = SubscribeSchema.parse(body);

    const { email, phone, deliveryMethod, questionId, question, frequencyDays } = validatedData;

    console.log(`Processing subscription: ${email || phone} via ${deliveryMethod} for question "${question}" (every ${frequencyDays} days)`);

    // Format phone number if provided
    let formattedPhone = phone;
    if (phone) {
      const { formatPhoneNumber, validatePhoneNumber } = await import('@/services/sms');
      if (!validatePhoneNumber(phone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
      formattedPhone = formatPhoneNumber(phone);
    }

    // Check if this contact is already subscribed to this question
    const existing = await db.query.questionSubscriptions.findFirst({
      where: (subs, { and, eq, or }) =>
        and(
          or(
            email ? eq(subs.email, email) : undefined,
            formattedPhone ? eq(subs.phone, formattedPhone) : undefined
          ),
          eq(subs.questionId, questionId),
          eq(subs.active, true)
        ),
    });

    if (existing) {
      // Update existing subscription
      await db
        .update(questionSubscriptions)
        .set({
          email: email || existing.email,
          phone: formattedPhone || existing.phone,
          deliveryMethod,
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
      email: email || null,
      phone: formattedPhone || null,
      deliveryMethod,
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
