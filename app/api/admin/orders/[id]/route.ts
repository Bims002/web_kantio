import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminRequest } from "@/lib/admin-route";
import { NextResponse } from "next/server";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { response } = await requireAdminRequest();
  if (response) return response;

  const orderId = params.id;

  // First delete all order items (foreign key constraint)
  await supabaseAdmin
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  // Then delete the order itself
  const { error } = await supabaseAdmin
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
