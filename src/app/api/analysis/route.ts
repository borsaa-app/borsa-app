import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/market/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase().replace(".IS", "");
  if (!symbol) {
    return NextResponse.json({ error: "symbol parametresi gerekli" }, { status: 400 });
  }
  const result = await getAnalysis(symbol);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ analysis: result.analysis, fetchedAt: Date.now() });
}
