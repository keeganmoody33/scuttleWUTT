import { NextRequest, NextResponse } from 'next/server';
import { db, questionSubscriptions } from '@/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { isValidVerificationCode, isVerificationCodeExpired } from '@/services/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = VerifySchema.parse(body);
    const { subscriptionId, code } = validatedData;

    // Validate code format
    if (!isValidVerificationCode(code)) {
      return NextResponse.json(
        { error: 'Invalid verification code format' },
        { status: 400 }
      );
    }

    console.log(`Verifying subscription ${subscriptionId} with code ${code}`);

    // Get subscription
    const subscription = await db.query.questionSubscriptions.findFirst({
      where: (subs, { eq }) => eq(subs.id, subscriptionId),
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Check if already verified
    if (subscription.verified) {
      return NextResponse.json({
        message: 'Subscription already verified',
        verified: true,
      });
    }

    // Check if code matches
    if (subscription.verificationCode !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if code expired
    if (isVerificationCodeExpired(subscription.verificationCodeExpiresAt)) {
      return NextResponse.json(
        { error: 'Verification code expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark as verified
    await db
      .update(questionSubscriptions)
      .set({
        verified: true,
        verificationCode: null, // Clear the code
        verificationCodeExpiresAt: null,
      })
      .where(eq(questionSubscriptions.id, subscriptionId));

    console.log(`✓ Verified subscription: ${subscriptionId}`);

    return NextResponse.json({
      message: 'Subscription verified successfully!',
      verified: true,
    });
  } catch (error) {
    console.error('Error verifying subscription:', error);

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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Resend verification code
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Get subscription
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

    // Generate new code
    const { generateVerificationCode, getCodeExpirationTime } = await import('@/services/verification');
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiresAt = getCodeExpirationTime();

    // Update subscription
    await db
      .update(questionSubscriptions)
      .set({
        verificationCode,
        verificationCodeExpiresAt,
        verificationSentAt: new Date(),
      })
      .where(eq(questionSubscriptions.id, subscriptionId));

    // Resend verification code
    if (subscription.deliveryMethod === 'email' || subscription.deliveryMethod === 'both') {
      if (subscription.email) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

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
    }

    if (subscription.deliveryMethod === 'sms' || subscription.deliveryMethod === 'both') {
      if (subscription.phone) {
        const twilio = (await import('twilio')).default;
        const twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        await twilioClient.messages.create({
          body: `Scuttle What verification code: ${verificationCode}\n\nEnter this code to activate your subscription. Expires in 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: subscription.phone,
        });
      }
    }

    console.log(`✓ Resent verification code for subscription: ${subscriptionId}`);

    return NextResponse.json({
      message: 'Verification code resent successfully',
    });
  } catch (error) {
    console.error('Error resending verification code:', error);

    return NextResponse.json(
      {
        error: 'Failed to resend verification code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
