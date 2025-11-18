import { env } from '@/lib/env';

export interface AuthResult {
  authorized: boolean;
  reason?: string;
}

export function authorizeRequest(request: Request): AuthResult {
  if (!env.API_ACCESS_TOKEN) {
    return { authorized: true };
  }

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return { authorized: false, reason: 'Missing authorization token' };
  }

  const token = header.slice('Bearer '.length).trim();
  if (token !== env.API_ACCESS_TOKEN) {
    return { authorized: false, reason: 'Invalid authorization token' };
  }

  return { authorized: true };
}