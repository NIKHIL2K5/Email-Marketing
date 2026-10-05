import crypto from 'crypto';
import { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'fc_operator_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'FirstClient_Session_Secret_2026_SecureKey_#991!';
const OPERATOR_USERNAME = process.env.OPERATOR_USERNAME || 'admin';
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD || 'FirstClient_2026_Admin!';

export interface SessionPayload {
  username: string;
  role: 'operator' | 'admin';
  exp: number;
}

export function validateOperatorCredentials(user: string, pass: string): boolean {
  if (!user || !pass) return false;
  return user.trim() === OPERATOR_USERNAME && pass.trim() === OPERATOR_PASSWORD;
}

export function signSessionToken(username: string): string {
  const payload: SessionPayload = {
    username,
    role: 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

export function verifySessionToken(token: string): { valid: boolean; username?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [data, hmac] = parts;
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (hmac !== expectedHmac) return { valid: false };

    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) return { valid: false };

    return { valid: true, username: payload.username };
  } catch {
    return { valid: false };
  }
}

export function getAuthenticatedOperator(request: NextRequest): { authenticated: boolean; username?: string } {
  // 1. Check cookie
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (cookie?.value) {
    const res = verifySessionToken(cookie.value);
    if (res.valid) return { authenticated: true, username: res.username };
  }

  // 2. Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const res = verifySessionToken(token);
    if (res.valid) return { authenticated: true, username: res.username };
  }

  return { authenticated: false };
}

export { SESSION_COOKIE_NAME };
