import twilio from 'twilio';
import { formatAnswerAsText, type QuestionAnswer } from './question-answering';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

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

/**
 * Send SMS update
 */
export async function sendSMSUpdate(
  phone: string,
  question: string,
  answer: QuestionAnswer
): Promise<void> {
  if (!TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }

  // Format answer for SMS
  const body = formatAnswerForSMS(answer, question);

  // Check if message is too long (SMS limit is 1600 chars)
  if (body.length > 1600) {
    // Send shorter version
    const shortBody = `Scuttle What Update: "${question}"\n\n${answer.tools.length} tools found. Visit scuttlewhat.com to see full details.\n\n${answer.tools.map((t, i) => `${i + 1}. ${t.name} - ${t.link}`).join('\n')}`;

    await twilioClient.messages.create({
      body: shortBody,
      from: TWILIO_PHONE_NUMBER,
      to: phone,
    });
  } else {
    await twilioClient.messages.create({
      body,
      from: TWILIO_PHONE_NUMBER,
      to: phone,
    });
  }

  console.log(`✓ Sent SMS to ${phone}`);
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
