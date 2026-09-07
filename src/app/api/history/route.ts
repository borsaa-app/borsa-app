import { NextResponse } from "next/server";
import { getHistory } from "@/lib/market/providers";
import { findStock } from "@/lib/market/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase().replace(".IS", "");
  const range = searchParams.get("range") ?? "6mo";
  const interval = searchParams.get("interval") ?? "1d";

  if (!symbol) return NextResponse.json({ error: "symbol parametresi gerekli" }, { status: 400 });

  const meta = findStock(symbol);
  const yahooSymbol = meta ? symbol : `${symbol}.IS`;

  const result = await getHistory(yahooSymbol, range, interval);
  if (!result.data) {
    return NextResponse.json({ error: result.error ?? "Geçmiş veri alınamadı." }, { status: 404 });
  }
  return NextResponse.json({
    symbol: result.data.symbol,
    candles: result.data.candles,
    meta: result.data.meta,
    source: result.data.source,
    sourceNote:
      result.data.source === "midas"
        ? "Veri kaynağı: Midas"
        : "Veri kaynağı: Yahoo Finance — İstanbul Borsası. BIST verileri borsa saatlerinde ~15 dk gecikmeli olabilir.",
    fetchedAt: result.data.fetchedAt,
  });
}
