import { requireAdminRequest, getRouteErrorMessage } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface MaterialPayload {
  name?: string;
  category?: string;
  unit?: string;
  icon?: string | null;
}

function sanitizeMaterialPayload(body: MaterialPayload) {
  return {
    name: body.name?.trim() || '',
    category: body.category?.trim() || '',
    unit: body.unit?.trim() || '',
    icon: body.icon?.trim() || null,
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/admin/materials/[id]'>
) {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as MaterialPayload;
    const payload = sanitizeMaterialPayload(body);

    if (!payload.name || !payload.category || !payload.unit) {
      return Response.json(
        { error: 'Nom, categorie et unite sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('materials')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ material: data });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          "Impossible de mettre a jour l'article."
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/admin/materials/[id]'>
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
      .eq('material_id', id);

    if (cleanup.error) {
      throw cleanup.error;
    }

    const { error } = await supabaseServer.from('materials').delete().eq('id', id);

    if (error) {
      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          "Suppression de l'article impossible."
        ),
      },
      { status: 500 }
    );
  }
}
