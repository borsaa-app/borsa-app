import { NextResponse } from "next/server";
import { getAnalysis, getRegime } from "@/lib/market/service";
import { getHistory } from "@/lib/market/providers";
import { getStockNews, aggregateNews } from "@/lib/market/news";
import { findStock } from "@/lib/market/symbols";
import { computeIndicators } from "@/lib/analysis/indicators";
import { findLevels } from "@/lib/analysis/support-resistance";
import { evaluatePosition } from "@/lib/analysis/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pozisyon değerlendirme (Smart Exit):
 * kullanıcının giriş maliyetine karşı canlı analiz yapar.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase().replace(".IS", "");
  const entry = Number(searchParams.get("entry"));
  const qty = Number(searchParams.get("qty") ?? 1);

  if (!symbol || !entry || entry <= 0) {
    return NextResponse.json({ error: "symbol ve entry (giriş maliyeti) gerekli." }, { status: 400 });
  }

  const meta = findStock(symbol);
  if (!meta) return NextResponse.json({ error: `Bilinmeyen sembol: ${symbol}` }, { status: 404 });

  const result = await getAnalysis(symbol);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  const analysis = result.analysis;
  const hist = await getHistory(symbol, "1y", "1d");
  if (!hist.data) return NextResponse.json({ error: "Geçmiş veri alınamadı." }, { status: 502 });

  const ind = computeIndicators(hist.data.candles);
  const { supports, resistances } = findLevels(hist.data.candles, ind.price);
  const newsItems = await getStockNews(symbol, meta.name, 10);
  const newsAgg = aggregateNews(newsItems);
  const regime = await getRegime();

  const advice = evaluatePosition(entry, qty, ind, supports, resistances, newsAgg, regime);

  const price = analysis.quote.price;
  const gainPct = ((price - entry) / entry) * 100;
  const weekAgo = analysis.weekAgoClose;
  const monthAgo = analysis.monthAgoClose;

  return NextResponse.json({
    symbol,
    advice,
    metrics: {
      price,
      gainPct: Math.round(gainPct * 100) / 100,
      dailyChangePct: analysis.quote.changePercent,
      weeklyChangePct: weekAgo ? Math.round(((price - weekAgo) / weekAgo) * 10000) / 100 : null,
      monthlyChangePct: monthAgo ? Math.round(((price - monthAgo) / monthAgo) * 10000) / 100 : null,
      totalPL: Math.round((price - entry) * qty * 100) / 100,
      dailyPL: Math.round(analysis.quote.change * qty * 100) / 100,
      weeklyPL: weekAgo ? Math.round((price - weekAgo) * qty * 100) / 100 : null,
    },
    decision: analysis.decision,
    position: analysis.position,
    dataNote: analysis.dataNote,
    fetchedAt: Date.now(),
  });
}
