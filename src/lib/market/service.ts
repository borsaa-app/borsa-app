/**
 * Paylaşımlı sunucu yardımcıları — piyasa rejimi + analiz servisi (cache'li)
 */

import { getHistory, getQuote, type History, type Quote } from "@/lib/market/providers";
import { INDEX_SYMBOLS, findStock } from "@/lib/market/symbols";
import { detectRegime, type Regime } from "@/lib/analysis/support-resistance";
import { getStockNews, aggregateNews, type MarketNewsResult } from "@/lib/market/news";
import { runAnalysis, type Analysis } from "@/lib/analysis/engine";

let regimeCache: { regime: Regime; at: number } | null = null;

function liveFallbackChange(hist: History): number {
  const n = hist.candles.length;
  if (n < 2) return 0;
  return hist.candles[n - 1].close - hist.candles[n - 2].close;
}

export async function getRegime(): Promise<Regime> {
  if (regimeCache && Date.now() - regimeCache.at < 5 * 60_000) return regimeCache.regime;
  const hist = await getHistory(INDEX_SYMBOLS.bist100.yahoo.replace(".IS", ""), "1y", "1d");
  if (!hist.data) {
    // Veri yoksa: veri yok bilgisiyle nötr rejim döndür (uydurma değil)
    const fallback: Regime = {
      type: "yatay",
      label: "BELİRSİZ",
      description: "Endeks verisi alınamadı — piyasa rejimi tespit edilemedi.",
      bist100Change: 0,
      bist100Trend: "yatay",
      volatilityLevel: "orta",
      momentumScore: 0,
      advice: "Veri bağlantısı düzelene kadar temkinli davranın.",
    };
    return fallback;
  }
  const regime = detectRegime(hist.data.candles);
  regimeCache = { regime, at: Date.now() };
  return regime;
}

interface AnalysisEntry {
  analysis: Analysis;
  at: number;
}

const analysisCache = new Map<string, AnalysisEntry>();

export async function getAnalysis(symbol: string): Promise<{ ok: true; analysis: Analysis } | { ok: false; error: string }> {
  const meta = findStock(symbol);
  if (!meta) return { ok: false, error: `Bilinmeyen sembol: ${symbol}. Midas/BIST evreninde bu sembol bulunamadı.` };

  const cached = analysisCache.get(meta.symbol);
  if (cached && Date.now() - cached.at < 3 * 60_000) return { ok: true, analysis: cached.analysis };

  const sym = meta.symbol;
  const [histRes, newsItems, quoteRes] = await Promise.all([
    getHistory(sym, "2y", "1d"),
    getStockNews(sym, meta.name, 12),
    getQuote(sym),
  ]);
  if (!histRes.data) return { ok: false, error: histRes.error ?? "Geçmiş veri alınamadı." };

  const regime = await getRegime();
  const news: MarketNewsResult = aggregateNews(newsItems);
  const lastCandle = histRes.data.candles[histRes.data.candles.length - 1];
  const prevCandle = histRes.data.candles[histRes.data.candles.length - 2];
  const liveQuote = quoteRes.data;
  const quote: Quote = liveQuote ?? {
    symbol: sym,
    price: histRes.data.meta.regularMarketPrice ?? lastCandle.close,
    change: liveFallbackChange(histRes.data),
    changePercent: prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0,
    dayHigh: lastCandle.high,
    dayLow: lastCandle.low,
    prevClose: prevCandle?.close ?? lastCandle.close,
    volume: histRes.data.meta.regularMarketVolume ?? lastCandle.volume,
    marketTime: Date.now(),
    currency: histRes.data.meta.currency,
  };
  const analysis = runAnalysis(sym, meta.name, meta.sector, quote, histRes.data, regime, news);

  analysisCache.set(sym, { analysis, at: Date.now() });
  return { ok: true, analysis };
}

export function historyToChart(hist: History): { time: number; open: number; high: number; low: number; close: number; volume: number }[] {
  return hist.candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}
