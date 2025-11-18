import twilio from 'twilio';
import { formatAnswerAsText, type QuestionAnswer } from './question-answering';
import { env } from '@/lib/env';
import { logger } from '@/services/logger';

const hasTwilioConfig =
  Boolean(env.TWILIO_ACCOUNT_SID) &&
  Boolean(env.TWILIO_AUTH_TOKEN) &&
  Boolean(env.TWILIO_PHONE_NUMBER);

const twilioClient = hasTwilioConfig
  ? twilio(env.TWILIO_ACCOUNT_SID as string, env.TWILIO_AUTH_TOKEN as string)
  : null;

function requireTwilioClient() {
  if (!twilioClient || !env.TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio is not configured');
  }

  return { client: twilioClient, from: env.TWILIO_PHONE_NUMBER };
}

/**
 * Format answer for SMS (shorter, text-only)
 */
export function formatAnswerForSMS(answer: QuestionAnswer, question: string): string {
  const lines = [`"${question}"\n`];

  answer.tools.forEach((tool, index) => {
    lines.push(`${index + 1}. ${tool.name}`);
    lines.push(`   ${tool.useCase}`);
    lines.push(`   ✓ ${tool.proof}`);
    lines.push(`   ⚠ ${tool.downside}`);
    lines.push(`   → ${tool.link}\n`);
  });

  lines.push('Powered by Scuttle What');

  return lines.join('\n');
}

export async function sendSMSMessage(phone: string, body: string): Promise<void> {
  const { client, from } = requireTwilioClient();
  await client.messages.create({
    body,
    from,
    to: phone,
  });
  logger.info('Sent SMS message', { phone });
}

export async function sendVerificationCodeSMS(phone: string, verificationCode: string): Promise<void> {
  const verificationBody = `Scuttle What verification code: ${verificationCode}\n\nEnter this code to activate your subscription. Expires in 10 minutes.`;
  await sendSMSMessage(phone, verificationBody);
}

export async function sendSMSUpdate(
  phone: string,
  question: string,
  answer: QuestionAnswer,
  changesSummary?: string
): Promise<void> {
  const { } = requireTwilioClient(); // Throws early if misconfigured

  let body = formatAnswerForSMS(answer, question);

  if (changesSummary) {
    body = `${changesSummary}${body}`;
  }

  if (body.length > 1600) {
    const shortBody = `Scuttle What Update: "${question}"\n\n${answer.tools.length} tools found. Visit scuttlewhat.com to see full details.\n\n${answer.tools
      .map((tool, index) => `${index + 1}. ${tool.name} - ${tool.link}`)
      .join('\n')}`;
    await sendSMSMessage(phone, shortBody);
  } else {
    await sendSMSMessage(phone, body);
  }

  logger.info('Sent SMS update', { phone, question });
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Must be 10-15 digits (international format)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return false;
  }

  return true;
}

/**
 * Format phone number to E.164 format (required by Twilio)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }

  // Add + prefix if not present
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}
