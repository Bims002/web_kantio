import { requireAdminRequest, getRouteErrorMessage } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface PricePayload {
  supplier_id?: string;
  material_id?: string;
  price?: number;
  unit?: string;
}

function sanitizePricePayload(body: PricePayload) {
  return {
    supplier_id: body.supplier_id?.trim() || '',
    material_id: body.material_id?.trim() || '',
    price: Number(body.price) || 0,
    unit: body.unit?.trim() || '',
  };
}

export async function POST(request: Request) {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as PricePayload;
    const payload = sanitizePricePayload(body);

    if (!payload.supplier_id || !payload.material_id || !payload.price || !payload.unit) {
      return Response.json(
        { error: 'Fournisseur, article, prix et unite sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('supplier_materials')
      .insert(payload)
      .select('*, supplier:suppliers(id,name,city), material:materials(*)')
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ price: data });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          "Impossible d'enregistrer le tarif."
        ),
      },
      { status: 500 }
    );
  }
}
