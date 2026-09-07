import { NextResponse } from "next/server";
import { getAllTrades, createTrade } from "@/lib/db/trades";

export const dynamic = "force-dynamic";

export async function GET() {
  const trades = await getAllTrades();
  return NextResponse.json({ trades });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    positionId?: string;
    symbol?: string;
    action?: string;
    quantity?: number;
    price?: number;
    reason?: string;
  } | null;

  if (!body?.symbol || !body?.action || !body?.quantity || !body?.price) {
    return NextResponse.json({ error: "symbol, action, quantity ve price gerekli." }, { status: 400 });
  }

  await createTrade({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    positionId: body.positionId ?? "",
    symbol: body.symbol.toUpperCase(),
    action: body.action,
    quantity: body.quantity,
    price: body.price,
    at: new Date(),
    reason: body.reason ?? null,
  });

  return NextResponse.json({ ok: true });
}
