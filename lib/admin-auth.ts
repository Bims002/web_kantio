import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const ADMIN_SESSION_COOKIE = 'kantioo_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function requireAdminEnv(name: 'ADMIN_EMAIL' | 'ADMIN_PASSWORD' | 'ADMIN_SESSION_SECRET') {
  const value = process.env[name];

  if (!value) {
    throw new Error(`La variable d'environnement ${name} est manquante.`);
  }

  return value;
}

function createSessionSignature(email: string, expiresAt: string) {
  const secret = requireAdminEnv('ADMIN_SESSION_SECRET');

  return createHmac('sha256', secret).update(`${email}:${expiresAt}`).digest('hex');
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseSessionValue(sessionValue: string) {
  // Use '|' as separator to avoid conflicts with dots in email addresses
  const parts = sessionValue.split('|');

  if (parts.length !== 3) {
    return null;
  }

  const [email, expiresAt, signature] = parts;

  if (!email || !expiresAt || !signature) {
    return null;
  }

  return { email, expiresAt, signature };
}

export function getAdminEmail() {
  return requireAdminEnv('ADMIN_EMAIL');
}

export async function authenticateAdminCredentials(email: string, password: string) {
  const expectedEmail = requireAdminEnv('ADMIN_EMAIL').trim().toLowerCase();
  const expectedPassword = requireAdminEnv('ADMIN_PASSWORD');
  const normalizedEmail = email.trim().toLowerCase();

  return safeCompare(normalizedEmail, expectedEmail) && safeCompare(password, expectedPassword);
}

export async function createAdminSession(email: string) {
  const cookieStore = await cookies();
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = String(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
  const signature = createSessionSignature(normalizedEmail, expiresAt);

  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: `${normalizedEmail}|${expiresAt}|${signature}`,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession() {
  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

    if (!rawSession) {
      return null;
    }

    const parsed = parseSessionValue(rawSession);

    if (!parsed) {
      return null;
    }

    const expectedEmail = requireAdminEnv('ADMIN_EMAIL').trim().toLowerCase();
    const expectedSignature = createSessionSignature(parsed.email, parsed.expiresAt);
    const expiresAt = Number(parsed.expiresAt);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return null;
    }

    if (!safeCompare(parsed.email, expectedEmail)) {
      return null;
    }

    if (!safeCompare(parsed.signature, expectedSignature)) {
      return null;
    }

    return {
      email: parsed.email,
    };
  } catch {
    return null;
  }
}
