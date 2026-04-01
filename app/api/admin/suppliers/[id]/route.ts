import { getCanonicalCityLabel } from '@/lib/cities';
import { requireAdminRequest, getRouteErrorMessage, RouteContext } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';
import type { Supplier } from '@/lib/types';

export const runtime = 'nodejs';

interface SupplierPayload {
  name?: string;
  phone?: string;
  contact_name?: string | null;
  email?: string | null;
  city?: string;
  quartier?: string | null;
  address?: string | null;
  lat?: number;
  lng?: number;
  delivery_radius?: number;
  delivery_delay_hours?: number;
  stock_availability?: Supplier['stock_availability'];
  is_active?: boolean;
}

function sanitizeSupplierPayload(body: SupplierPayload) {
  return {
    name: body.name?.trim() || '',
    phone: body.phone?.trim() || '',
    contact_name: body.contact_name?.trim() || null,
    email: body.email?.trim() || null,
    city: getCanonicalCityLabel(body.city),
    quartier: body.quartier?.trim() || null,
    address: body.address?.trim() || null,
    lat: Number(body.lat) || 0,
    lng: Number(body.lng) || 0,
    delivery_radius: Number(body.delivery_radius) || 20,
    delivery_zones: null,
    delivery_delay_hours: Number(body.delivery_delay_hours) || 24,
    stock_availability: body.stock_availability || 'permanent',
    is_active: Boolean(body.is_active),
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/admin/suppliers/[id]'>
) {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as SupplierPayload;
    const payload = sanitizeSupplierPayload(body);

    if (!payload.name || !payload.phone || !payload.city) {
      return Response.json(
        { error: 'Nom, numero et ville sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('suppliers')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ supplier: data });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          "Impossible de mettre a jour le fournisseur."
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/admin/suppliers/[id]'>
) {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    const cleanup = await supabaseServer
      .from('supplier_materials')
      .delete()
      .eq('supplier_id', id);

    if (cleanup.error) {
      throw cleanup.error;
    }

    const { error } = await supabaseServer.from('suppliers').delete().eq('id', id);

    if (error) {
      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          'Suppression du fournisseur impossible.'
        ),
      },
      { status: 500 }
    );
  }
}
