import { NextResponse } from "next/server";
import { getAllAlerts, createAlert, clearAlerts } from "@/lib/db/alert-log";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await getAllAlerts();
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    symbol?: string;
    type?: string;
    message?: string;
  } | null;

  if (!body?.symbol || !body?.type || !body?.message) {
    return NextResponse.json({ error: "symbol, type ve message gerekli." }, { status: 400 });
  }

  await createAlert({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol: body.symbol,
    type: body.type,
    message: body.message,
    at: new Date(),
    read: false,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAlerts();
  return NextResponse.json({ ok: true });
}
