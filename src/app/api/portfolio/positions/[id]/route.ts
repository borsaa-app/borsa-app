import { NextResponse } from "next/server";
import { updatePosition, deletePosition } from "@/lib/db/positions";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    quantity?: number;
    avgCost?: number;
    notes?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Geçerli veri gerekli." }, { status: 400 });
  }

  await updatePosition(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletePosition(id);
  return NextResponse.json({ ok: true });
}
