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
    const body = await request.json();

    // Validate input
    const validatedData = SubscribeSchema.parse(body);

    const { email, phone, deliveryMethod, questionId, question, frequencyDays, notifyOnChangeOnly } = validatedData;

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
          notifyOnChangeOnly,
          nextSendAt: new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000),
        })
        .where(eq(questionSubscriptions.id, existing.id));

      console.log(`✓ Updated existing subscription: ${existing.id}`);

      return NextResponse.json({
        message: 'Subscription updated successfully',
        subscriptionId: existing.id,
      });
    }

    // Create new subscription (unverified)
    const subscriptionId = generateId('sub');
    const nextSendAt = new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000);

    // Generate verification code
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
      verified: false, // Not verified yet
      verificationCode,
      verificationCodeExpiresAt,
      verificationSentAt: new Date(),
      active: true,
      createdAt: new Date(),
    });

    // Send verification code
    if (deliveryMethod === 'email' || deliveryMethod === 'both') {
      if (email) {
        // Send email verification
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

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

        console.log(`✓ Sent email verification code to ${email}`);
      }
    }

    if (deliveryMethod === 'sms' || deliveryMethod === 'both') {
      if (formattedPhone) {
        // Send SMS verification
        const { sendSMSUpdate } = await import('@/services/sms');
        const twilio = (await import('twilio')).default;
        const twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        await twilioClient.messages.create({
          body: `Scuttle What verification code: ${verificationCode}\n\nEnter this code to activate your subscription. Expires in 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });

        console.log(`✓ Sent SMS verification code to ${formattedPhone}`);
      }
    }

    console.log(`✓ Created subscription: ${subscriptionId} (unverified)`);

    return NextResponse.json({
      message: 'Verification code sent. Please check your email/phone.',
      subscriptionId,
      requiresVerification: true,
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
