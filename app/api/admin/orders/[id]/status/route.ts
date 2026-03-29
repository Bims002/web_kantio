import { requireAdminRequest, getRouteErrorMessage } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';
import type { Order } from '@/lib/types';

export const runtime = 'nodejs';

const ALLOWED_ORDER_STATUSES: Order['status'][] = [
  'pending',
  'confirmed',
  'in_delivery',
  'delivered',
  'cancelled',
];

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/admin/orders/[id]/status'>
) {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: Order['status'] };
    const status = body.status;

    if (!status || !ALLOWED_ORDER_STATUSES.includes(status)) {
      return Response.json(
        { error: 'Statut de commande invalide.' },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const deliveredAt = status === 'delivered' ? updatedAt : null;
    const { data, error } = await supabaseServer
      .from('orders')
      .update({
        status,
        updated_at: updatedAt,
        delivered_at: deliveredAt,
      })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ order: data });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          'Mise a jour du statut impossible.'
        ),
      },
      { status: 500 }
    );
  }
}
