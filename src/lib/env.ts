import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  PRODUCTHUNT_API_KEY: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  GOOGLE_TRENDS_DISABLED: z.enum(['true', 'false']).optional(),
  API_ACCESS_TOKEN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
});

const rawEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  PRODUCTHUNT_API_KEY: process.env.PRODUCTHUNT_API_KEY,
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  GOOGLE_TRENDS_DISABLED: process.env.GOOGLE_TRENDS_DISABLED,
  API_ACCESS_TOKEN: process.env.API_ACCESS_TOKEN,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
};

const parsed = EnvSchema.safeParse(rawEnv);

if (!parsed.success) {
  const formattedErrors = parsed.error.errors
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${formattedErrors}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
};

// Production security validation
if (isProduction) {
  const warnings: string[] = [];

  if (!env.API_ACCESS_TOKEN) {
    warnings.push(
      '⚠️  SECURITY WARNING: API_ACCESS_TOKEN is not set in production!\n' +
      '   All API routes are currently unprotected and accessible without authentication.\n' +
      '   Set API_ACCESS_TOKEN environment variable to enable Bearer token authentication.\n' +
      '   Generate a secure token with: openssl rand -base64 32'
    );
  }

  if (!env.CRON_SECRET) {
    warnings.push(
      '⚠️  SECURITY WARNING: CRON_SECRET is not set in production!\n' +
      '   Cron endpoints (/api/cron/*) are unprotected and could be triggered by anyone.\n' +
      '   Set CRON_SECRET environment variable to protect scheduled jobs.\n' +
      '   Generate a secure secret with: openssl rand -base64 32'
    );
  }

  if (warnings.length > 0) {
    console.warn('\n' + '='.repeat(80));
    console.warn('PRODUCTION SECURITY WARNINGS');
    console.warn('='.repeat(80));
    warnings.forEach((warning) => {
      console.warn('\n' + warning);
    });
    console.warn('\n' + '='.repeat(80) + '\n');
  }
}

