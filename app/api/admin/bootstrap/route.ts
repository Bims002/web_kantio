import { requireAdminRequest, getRouteErrorMessage } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const [ordersResult, suppliersResult, materialsResult] = await Promise.all([
      supabaseServer
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false }),
      supabaseServer.from('suppliers').select('*').order('name'),
      supabaseServer.from('materials').select('*').order('name'),
    ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    if (suppliersResult.error) {
      throw suppliersResult.error;
    }

    if (materialsResult.error) {
      throw materialsResult.error;
    }

    return Response.json({
      adminEmail: auth.session?.email || '',
      orders: ordersResult.data || [],
      suppliers: suppliersResult.data || [],
      materials: materialsResult.data || [],
    });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          "Impossible de charger les donnees admin."
        ),
      },
      { status: 500 }
    );
  }
}
