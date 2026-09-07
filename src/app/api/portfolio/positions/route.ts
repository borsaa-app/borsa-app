import { NextResponse } from "next/server";
import { getAllPositions, createPosition } from "@/lib/db/positions";

export const dynamic = "force-dynamic";

export async function GET() {
  const positions = await getAllPositions();
  return NextResponse.json({ positions });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    symbol?: string;
    name?: string;
    quantity?: number;
    avgCost?: number;
    notes?: string;
  } | null;

  if (!body?.symbol || !body?.name || !body?.quantity || !body?.avgCost) {
    return NextResponse.json({ error: "symbol, name, quantity ve avgCost gerekli." }, { status: 400 });
  }

  await createPosition({
    id: body.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: body.symbol.toUpperCase(),
    name: body.name,
    quantity: body.quantity,
    avgCost: body.avgCost,
    createdAt: new Date(),
    notes: body.notes ?? null,
  });

  return NextResponse.json({ ok: true });
}
