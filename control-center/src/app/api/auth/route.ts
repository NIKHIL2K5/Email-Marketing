import { NextRequest, NextResponse } from 'next/server';
import {
  validateOperatorCredentials,
  signSessionToken,
  getAuthenticatedOperator,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getAuthenticatedOperator(request);
  return NextResponse.json(session);
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'login';

    if (action === 'logout') {
      const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!validateOperatorCredentials(username, password)) {
      return NextResponse.json(
        { error: 'Invalid operator credentials' },
        { status: 401 }
      );
    }

    const token = signSessionToken(username.trim());
    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
      username: username.trim(),
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('[api/auth:POST:error]', error);
    return NextResponse.json({ error: 'Authentication request failed' }, { status: 500 });
  }
}
