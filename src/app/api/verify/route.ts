import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { isValidVerificationCode, isVerificationCodeExpired } from '@/services/verification';
import { env } from '@/lib/env';
import { logger } from '@/services/logger';
import { sendVerificationCodeSMS } from '@/services/sms';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = enforceRateLimit(request, 'api:verify:post');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please wait.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();

    const validatedData = VerifySchema.parse(body);
    const { subscriptionId, code } = validatedData;

    if (!isValidVerificationCode(code)) {
      return NextResponse.json(
        { error: 'Invalid verification code format' },
        { status: 400 }
      );
    }

    logger.info('Verifying subscription', { subscriptionId });

    const subscription = await db.query.questionSubscriptions.findFirst({
      where: (subs, { eq }) => eq(subs.id, subscriptionId),
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.verified) {
      return NextResponse.json({
        message: 'Subscription already verified',
        verified: true,
      });
    }

    if (subscription.verificationCode !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    if (isVerificationCodeExpired(subscription.verificationCodeExpiresAt)) {
      return NextResponse.json(
        { error: 'Verification code expired. Please request a new one.' },
        { status: 400 }
      );
    }

    await db
      .update(questionSubscriptions)
      .set({
        verified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      })
      .where(eq(questionSubscriptions.id, subscriptionId));

    logger.info('Subscription verified', { subscriptionId });

    return NextResponse.json({
      message: 'Subscription verified successfully!',
      verified: true,
    });
  } catch (error) {
    logger.error('Error verifying subscription', error);

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
        error: 'Failed to verify subscription',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimit = enforceRateLimit(request, 'api:verify:resend');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many resend requests. Please wait.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    const subscription = await db.query.questionSubscriptions.findFirst({
      where: (subs, { eq }) => eq(subs.id, subscriptionId),
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.verified) {
      return NextResponse.json(
        { error: 'Subscription already verified' },
        { status: 400 }
      );
    }

    if (
      subscription.verificationSentAt &&
      Date.now() - new Date(subscription.verificationSentAt).getTime() < RESEND_COOLDOWN_MS
    ) {
      return NextResponse.json(
        { error: 'Please wait before requesting another code' },
        { status: 429 }
      );
    }

    const { generateVerificationCode, getCodeExpirationTime } = await import('@/services/verification');
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiresAt = getCodeExpirationTime();

    await db
      .update(questionSubscriptions)
      .set({
        verificationCode,
        verificationCodeExpiresAt,
        verificationSentAt: new Date(),
      })
      .where(eq(questionSubscriptions.id, subscriptionId));

    if ((subscription.deliveryMethod === 'email' || subscription.deliveryMethod === 'both') && subscription.email) {
      if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const { Resend } = await import('resend');
      const resend = new Resend(env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'Scuttle What <verify@scuttlewhat.com>',
        to: subscription.email,
        subject: 'Verify your Scuttle What subscription',
        html: `
            <h2>Verify your subscription</h2>
            <p>Your verification code is:</p>
            <h1 style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">${verificationCode}</h1>
            <p>This code expires in 10 minutes.</p>
            <p>Enter this code to activate your subscription to: "${subscription.question}"</p>
          `,
      });
    }

    if ((subscription.deliveryMethod === 'sms' || subscription.deliveryMethod === 'both') && subscription.phone) {
      await sendVerificationCodeSMS(subscription.phone, verificationCode);
    }

    logger.info('Resent verification code', { subscriptionId });

    return NextResponse.json({
      message: 'Verification code resent successfully',
    });
  } catch (error) {
    logger.error('Error resending verification code', error);

    return NextResponse.json(
      {
        error: 'Failed to resend verification code',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}
