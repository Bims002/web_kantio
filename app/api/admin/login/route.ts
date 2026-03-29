import { createHmac } from 'crypto';
import { authenticateAdminCredentials, getAdminEmail } from '@/lib/admin-auth';
import { getRouteErrorMessage } from '@/lib/admin-route';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ADMIN_SESSION_COOKIE = 'kantioo_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

// ---- Brute-force protection: in-memory rate limiting ----
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) return { limited: false };

  // Reset window if expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { limited: false };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.firstAttempt + WINDOW_MS - now) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  return { limited: false };
}

function recordAttempt(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Check rate limit BEFORE processing
  const rateCheck = isRateLimited(ip);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: `Trop de tentatives. Reessayez dans ${rateCheck.retryAfterSeconds} secondes.` },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim() || '';
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { error: "L'email admin et le mot de passe sont obligatoires." },
        { status: 400 }
      );
    }

    const isValid = await authenticateAdminCredentials(email, password);

    if (!isValid) {
      // Record failed attempt
      recordAttempt(ip);
      return NextResponse.json(
        { error: 'Identifiants admin invalides.' },
        { status: 401 }
      );
    }

    // Clear rate limiter on success
    clearAttempts(ip);

    const normalizedEmail = getAdminEmail().trim().toLowerCase();
    const expiresAt = String(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
    const secret = process.env.ADMIN_SESSION_SECRET!;
    const signature = createHmac('sha256', secret)
      .update(`${normalizedEmail}:${expiresAt}`)
      .digest('hex');

    const cookieValue = `${normalizedEmail}|${expiresAt}|${signature}`;

    const response = NextResponse.json({
      ok: true,
      email: normalizedEmail,
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: cookieValue,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      {
        error: getRouteErrorMessage(
          error,
          "Impossible d'ouvrir la session admin."
        ),
      },
      { status: 500 }
    );
  }
}
