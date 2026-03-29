import { clearAdminSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST() {
  await clearAdminSession();

  return Response.json({ ok: true });
}
