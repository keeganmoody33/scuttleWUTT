import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { logger } from '@/services/logger';
import { sendVerificationCodeSMS, formatPhoneNumber, validatePhoneNumber } from '@/services/sms';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SubscribeSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Invalid phone number').optional(),
  deliveryMethod: z.enum(['email', 'sms', 'both']).default('email'),
  questionId: z.string().min(1, 'Question ID is required'),
  question: z.string().min(5, 'Question must be at least 5 characters'),
  frequencyDays: z.number().int().min(1).max(90, 'Frequency must be between 1 and 90 days'),
  notifyOnChangeOnly: z.boolean().default(true),
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
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:subscribe');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many subscription attempts. Please wait.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();

    const validatedData = SubscribeSchema.parse(body);

    const { email, phone, deliveryMethod, questionId, question, frequencyDays, notifyOnChangeOnly } = validatedData;

    logger.info('Processing subscription request', {
      deliveryMethod,
      questionId,
      frequencyDays,
    });

    let formattedPhone = phone;
    if (phone) {
      if (!validatePhoneNumber(phone)) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
      formattedPhone = formatPhoneNumber(phone);
    }

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
      await db
        .update(questionSubscriptions)
        .set({
          email: email || existing.email,
          phone: formattedPhone || existing.phone,
          deliveryMethod,
          frequencyDays,
          notifyOnChangeOnly,
          nextSendAt: new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000),
        })
        .where(eq(questionSubscriptions.id, existing.id));

      logger.info('Updated existing subscription', { subscriptionId: existing.id });

      return NextResponse.json({
        message: 'Subscription updated successfully',
        subscriptionId: existing.id,
      });
    }

    const subscriptionId = generateId('sub');
    const nextSendAt = new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000);

    const { generateVerificationCode, getCodeExpirationTime } = await import('@/services/verification');
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiresAt = getCodeExpirationTime();

    await db.insert(questionSubscriptions).values({
      id: subscriptionId,
      email: email || null,
      phone: formattedPhone || null,
      deliveryMethod,
      questionId,
      question,
      frequencyDays,
      notifyOnChangeOnly,
      nextSendAt,
      verified: false,
      verificationCode,
      verificationCodeExpiresAt,
      verificationSentAt: new Date(),
      active: true,
      createdAt: new Date(),
    });

    if ((deliveryMethod === 'email' || deliveryMethod === 'both') && email) {
      if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const { Resend } = await import('resend');
      const resend = new Resend(env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'Scuttle What <verify@scuttlewhat.com>',
        to: email,
        subject: 'Verify your Scuttle What subscription',
        html: `
          <h2>Verify your subscription</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">${verificationCode}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>Enter this code to activate your subscription to: "${question}"</p>
        `,
      });
    }

    if ((deliveryMethod === 'sms' || deliveryMethod === 'both') && formattedPhone) {
      await sendVerificationCodeSMS(formattedPhone, verificationCode);
    }

    logger.info('Created new subscription (verification pending)', { subscriptionId });

    return NextResponse.json({
      message: 'Verification code sent. Please check your email/phone.',
      subscriptionId,
      requiresVerification: true,
      nextUpdateDate: nextSendAt,
    });
  } catch (error) {
    logger.error('Error creating subscription', error as Error);

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
        details: 'Please try again later.',
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

    logger.info('Subscription deactivated', { subscriptionId });

    return NextResponse.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    logger.error('Error unsubscribing', error as Error);

    return NextResponse.json(
      {
        error: 'Failed to unsubscribe',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}
