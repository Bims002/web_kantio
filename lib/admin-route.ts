import 'server-only';

import { getAdminSession } from '@/lib/admin-auth';

export async function requireAdminRequest() {
  const session = await getAdminSession();

  if (!session) {
    return {
      session: null,
      response: Response.json(
        { error: 'Session admin invalide ou expiree.' },
        { status: 401 }
      ),
    };
  }

  return {
    session,
    response: null,
  };
}

export function getRouteErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const candidate = error as { message?: string };

  return candidate.message || fallback;
}
