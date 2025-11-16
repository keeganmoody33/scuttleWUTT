/**
 * Verification service for email and SMS 2FA
 */

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  // Generate 6 random digits
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Check if verification code is expired (10 minutes)
 */
export function isVerificationCodeExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}

/**
 * Get code expiration time (10 minutes from now)
 */
export function getCodeExpirationTime(): Date {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}

/**
 * Validate verification code format
 */
export function isValidVerificationCode(code: string): boolean {
  // Must be exactly 6 digits
  return /^\d{6}$/.test(code);
}
