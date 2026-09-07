import { NextResponse } from "next/server";
import { getQuotes, getHistory, cachedFetch, cacheSet } from "@/lib/market/providers";
import { SYMBOLS, BIST_UNIVERSE } from "@/lib/market/symbols";
import { getRegime } from "@/lib/market/service";
import { computeIndicators } from "@/lib/analysis/indicators";
import { findLevels } from "@/lib/analysis/support-resistance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ScanRow {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  score: number;
  reason: string;
  volumeRatio: number | null;
  rsi: number | null;
  from52High: number | null;
  support: number | null;
  resistance: number | null;
}

interface ScanResult {
  lists: {
    bestOpportunities: ScanRow[];
    strongestMomentum: ScanRow[];
    biggestLosers: ScanRow[];
    recoveryCandidates: ScanRow[];
    lowestRisk: ScanRow[];
    highRiskHighReward: ScanRow[];
    oversoldBounce: ScanRow[];
    nearResistance: ScanRow[];
  };
  regime: Awaited<ReturnType<typeof getRegime>>;
  scanned: number;
  errors: string[];
  source: string;
  sourceNote: string;
  fetchedAt: number;
}

export async function GET() {
  const CACHE_KEY = "scan:full";
  const cached = cachedFetch<ScanResult>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const errors: string[] = [];
  try {
    const regime = await getRegime();
    const { quotes, errors: qErrors, source } = await getQuotes(SYMBOLS);
    for (const [k, v] of Object.entries(qErrors)) errors.push(`${k}: ${v}`);

    // Skorlama için 6 aylık geçmiş (cache'li — 5 dk TTL)
    const scored: ScanRow[] = [];
    const symbolsWithQuotes = Object.keys(quotes);
    const histResults = await Promise.all(
      symbolsWithQuotes.map(async (sym) => {
        const h = await getHistory(sym, "6mo", "1d");
        return { sym, hist: h.data };
      })
    );

    for (const { sym, hist } of histResults) {
      const q = quotes[sym];
      const meta = BIST_UNIVERSE.find((s) => s.symbol === sym);
      if (!meta || !q) continue;
      if (!hist || hist.candles.length < 60) {
        // Geçmiş veri yoksa fiyatlama verisiyle temel satır (skorsuz) — uydurma yok
        scored.push({
          symbol: sym,
          name: meta.name,
          sector: meta.sector,
          price: q.price,
          changePercent: q.changePercent,
          score: -1,
          reason: "Geçmiş veri yetersiz — yalnızca fiyat verisi mevcut.",
          volumeRatio: null,
          rsi: null,
          from52High: null,
          support: null,
          resistance: null,
        });
        continue;
      }
      const ind = computeIndicators(hist.candles);
      const { supports, resistances } = findLevels(hist.candles, ind.price);

      // Hızlı skor (engine'deki mantığın özet hali)
      let s = 50;
      const price = ind.price;
      if (ind.ema20 != null && ind.ema50 != null) {
        if (price > ind.ema20 && ind.ema20 > ind.ema50) s += 18;
        else if (price > ind.ema50) s += 6;
        else if (price < ind.ema20 && ind.ema20 < ind.ema50) s -= 18;
        else s -= 4;
      }
      if ((ind.macdHist ?? 0) > 0) s += 6;
      else s -= 6;
      const rsi = ind.rsi14 ?? 50;
      if (rsi > 70) s -= 4;
      else if (rsi > 55) s += 8;
      else if (rsi < 30) s += 6;
      else if (rsi < 45) s -= 6;
      if ((ind.volRatio ?? 1) > 1.5 && (ind.ret5d ?? 0) > 0) s += 8;
      if ((ind.volRatio ?? 1) > 2 && (ind.ret5d ?? 0) < -3) s -= 6;
      if (regime.type === "dusus" || regime.type === "panik") s -= 6;
      s = Math.max(0, Math.min(100, Math.round(s)));

      let reason: string;
      if (price > (ind.ema20 ?? price) && (ind.ema20 ?? 0) > (ind.ema50 ?? 0)) reason = "Fiyat EMA20/EMA50 üzerinde, trend yükseliş yapısında.";
      else if (price < (ind.ema50 ?? price)) reason = "Fiyat EMA50 altında, trend zayıf.";
      else reason = "Fiyat ortalamalar arasında sıkışmış, yön arıyor.";
      if ((ind.volRatio ?? 1) > 1.5) reason += ` Hacim ortalamanın ${Math.round((ind.volRatio ?? 1) * 100)}%.`;
      if ((ind.ret20d ?? 0) > 10) reason += ` 20 günlük +%${Math.round(ind.ret20d ?? 0)} güçlü momentum.`;

      scored.push({
        symbol: sym,
        name: meta.name,
        sector: meta.sector,
        price: q.price,
        changePercent: q.changePercent,
        score: s,
        reason,
        volumeRatio: ind.volRatio ? Math.round(ind.volRatio * 100) / 100 : null,
        rsi: ind.rsi14 ? Math.round(ind.rsi14 * 10) / 10 : null,
        from52High: ind.from52High ? Math.round(ind.from52High * 10) / 10 : null,
        support: supports[0]?.price ?? null,
        resistance: resistances[0]?.price ?? null,
      });
    }

    const valid = scored.filter((r) => r.score >= 0);
    const byScore = [...valid].sort((a, b) => b.score - a.score);
    const byMomentum = [...valid].sort((a, b) => (b.rsi ?? 0) + (b.volumeRatio ?? 1) * 10 - ((a.rsi ?? 0) + (a.volumeRatio ?? 1) * 10));
    const byLosers = [...valid].sort((a, b) => a.changePercent - b.changePercent);
    const recovery = [...valid]
      .filter((r) => (r.from52High ?? 0) < -15 && (r.rsi ?? 50) > 40 && (r.rsi ?? 50) < 60)
      .sort((a, b) => (a.rsi ?? 0) - (b.rsi ?? 0));
    const lowRisk = [...valid].sort((a, b) => (b.from52High ?? -99) - (a.from52High ?? -99));
    const highRisk = [...valid].filter((r) => (r.volumeRatio ?? 1) > 1.3 || Math.abs(r.changePercent) > 4).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    const oversold = [...valid].filter((r) => (r.rsi ?? 50) < 35).sort((a, b) => (a.rsi ?? 0) - (b.rsi ?? 0));
    const nearRes = [...valid]
      .filter((r) => r.resistance != null && r.resistance > 0 && (r.resistance - r.price) / r.price < 0.03)
      .sort((a, b) => b.score - a.score);

    const result: ScanResult = {
      lists: {
        bestOpportunities: byScore.slice(0, 8),
        strongestMomentum: byMomentum.slice(0, 8),
        biggestLosers: byLosers.slice(0, 8),
        recoveryCandidates: recovery.slice(0, 8),
        lowestRisk: lowRisk.slice(0, 8),
        highRiskHighReward: highRisk.slice(0, 8),
        oversoldBounce: oversold.slice(0, 8),
        nearResistance: nearRes.slice(0, 8),
      },
      regime,
      scanned: scored.length,
      errors: errors.slice(0, 10),
      source,
      sourceNote: `Veri kaynağı: ${source === "midas" ? "Midas" : source === "tradingview-bist" ? "TradingView — resmî BIST borsa verisi (Midas'ta görüntülenenle aynı)" : "Yahoo Finance — İstanbul Borsası"}. Skorlar 6 aylık gerçek fiyat verisinden hesaplanmıştır.`,
      fetchedAt: Date.now(),
    };
    cacheSet(CACHE_KEY, result, 3 * 60_000);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Piyasa taraması yapılamadı.", detail: e instanceof Error ? e.message : "bilinmeyen hata" },
      { status: 502 }
    );
  }
}
