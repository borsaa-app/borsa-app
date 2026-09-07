/**
 * BUGÜNÜN SEÇİMLERİ — Günlük Aksiyon Motoru
 *
 * Kullanıcının doğrudan sorduğu soruya net cevap üretir:
 *   "Bugün hangi hisse yükselecek? Hedefi kaç TL? 100 TL ile kaç TL kazandırır?"
 *
 * Yöntem (tamamen gerçek veriden):
 *  - TradingView resmî BIST fiyatları ile 57 hisse tek istekte taranır
 *  - Momentum (Perf.W, relVolume, RSI) + teknik yapı (EMA, MACD, ADX) + destek/direnç
 *  - Günlük hedef: ATR14 tabanlı gerçekçi hareket, dirence kadar kırpılır
 *  - Haftalık hedef: ATR14 x çarpan, direnç kırpımı
 *  - Stop: ATR14 tabanlı, destek altı
 *  - Güven skoru: yapı + momentum + hacim + rejim bileşimi (%)
 *
 * KESİN KURAL: Hedefler olasılıksal senaryodur, garanti değildir. Her seçimde
 * geçersizlik koşulu (invalidation) zorunludur. Veri yoksa seçim üretilmez.
 */

import { getQuotes, getHistory, cacheGet, cacheSet, tvCachedExtra, type TvExtra } from "@/lib/market/providers";
import { SYMBOLS, BIST_UNIVERSE } from "@/lib/market/symbols";
import { computeIndicators, type IndicatorSnapshot } from "./indicators";
import { findLevels, type Level, type Regime } from "./support-resistance";
import { getRegime } from "@/lib/market/service";
import type { Candle } from "@/lib/market/providers";

export interface DailyPick {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  direction: "YÜKSELİŞ" | "DIŞARIDA";
  todayTarget: number; // TL — gerçekçi günlük hedef (konservatif)
  todayTargetHigh: number; // TL — güçlü gün senaryosu
  todayTargetPct: number; // %
  todayTargetHighPct: number;
  weekTarget: number; // TL — 1 hafta hedefi
  weekTargetPct: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  riskReward: number;
  confidence: number; // 0-100 güven skoru
  profitPer100: number; // 100 TL için günlük beklenen kazanç (TL, konservatif)
  profitPer100High: number;
  reason: string; // net Türkçe gerekçe
  invalidation: string; // senaryo geçersizleşme koşulu
  rsi: number | null;
  volumeRatio: number | null;
  perfWeek: number | null;
  distanceResistancePct: number | null;
}

export interface AvoidItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  reason: string;
}

export interface PicksResponse {
  generatedAt: number;
  marketStatus: {
    open: boolean;
    session: "açılış öncesi" | "sabah seansı" | "öğle arası" | "öğleden sonra seansı" | "kapanış sonrası";
    nextEvent: string;
  };
  picks: DailyPick[];
  avoid: AvoidItem[];
  regime: Regime;
  headline: string;
  sourceNote: string;
  disclaimer: string;
}

/* ------------------------------------------------------------------ */
/* BIST işlem saatleri (TR saati)                                      */
/* ------------------------------------------------------------------ */

export function bistMarketStatus(now = new Date()): PicksResponse["marketStatus"] {
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const open = 10 * 60;
  const lunchStart = 13 * 60;
  const lunchEnd = 14 * 60;
  const close = 18 * 60;
  if (day === 0 || day === 6) {
    const nextMon = day === 0 ? 1 : 6 - day + 1;
    return { open: false, session: "kapanış sonrası", nextEvent: `Hafta sonu — borsa ${nextMon === 1 ? "pazartesi" : `${nextMon} gün sonra`} 10:00'de açılıyor.` };
  }
  if (mins < open) return { open: false, session: "açılış öncesi", nextEvent: "Borsa bugün 10:00'de açılıyor." };
  if (mins < lunchStart) return { open: true, session: "sabah seansı", nextEvent: "13:00'te öğle arası." };
  if (mins < lunchEnd) return { open: false, session: "öğle arası", nextEvent: "14:00'te seans devam ediyor." };
  if (mins < close) return { open: true, session: "öğleden sonra seansı", nextEvent: "18:00'de kapanış." };
  return { open: false, session: "kapanış sonrası", nextEvent: "Borsa yarın 10:00'de açılıyor." };
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

function roundTick(x: number): number {
  // BIST fiyat adımı çoğu hisse için 0.01 TL — 2 ondalığa yuvarla
  return Math.round(x * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Ana üretici                                                         */
/* ------------------------------------------------------------------ */

interface CandRow {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  extra: TvExtra;
  candles: Candle[];
  ind: IndicatorSnapshot;
  supports: Level[];
  resistances: Level[];
  fastScore: number;
}

export async function generateDailyPicks(debug = false): Promise<PicksResponse & { debug?: unknown }> {
  const CACHE_KEY = "picks:daily";
  const cached = cacheGet<PicksResponse>(CACHE_KEY);
  if (cached && !debug) return cached;

  const funnel: Record<string, unknown> = { fastRows: 0, candidates: 0, histOk: 0, structure: 0, targetOk: 0, rrOk: 0, drops: [] as string[] };

  const regime = await getRegime();
  const { quotes } = await getQuotes(SYMBOLS);

  // 1) Hızlı eleme: TV verisiyle yükseliş adayı havuzu
  interface FastRow {
    symbol: string;
    price: number;
    changePercent: number;
    score: number;
  }
  const fast: FastRow[] = [];
  for (const q of Object.values(quotes)) {
    const meta = BIST_UNIVERSE.find((s) => s.symbol === q.symbol);
    if (!meta) continue;
    const ex = tvCachedExtra(q.symbol) ?? {};
    const rsi = ex.rsi;
    const relVol = ex.relVolume ?? 1;
    const perfW = ex.perfWeek ?? 0;
    let s = 50;
    // Bugün pozitif ama aşırı taşmamış
    if (q.changePercent > 0.3 && q.changePercent < 6) s += 12;
    if (q.changePercent >= 6) s += 2;
    if (q.changePercent < -1) s -= 10;
    // RSI: güçlü ama aşırı alım değil
    if (rsi != null) {
      if (rsi > 55 && rsi < 70) s += 14;
      else if (rsi >= 70) s -= 6;
      else if (rsi > 45) s += 4;
      else if (rsi < 35) s += 6; // aşırı satım toparlanması
      else s -= 4;
    }
    // Hacim: ortalamanın üzerinde ilgi
    if (relVol > 1.3) s += 12;
    else if (relVol > 1.0) s += 5;
    else s -= 4;
    // Haftalık performans: trend teyidi
    if (perfW > 3) s += 10;
    else if (perfW > 0) s += 4;
    else if (perfW < -5) s -= 8;
    // Rejim: düşüş/panik piyasasında seçim sayısı doğal olarak azalır
    if (regime.type === "dusus" || regime.type === "panik") s -= 10;
    fast.push({ symbol: q.symbol, price: q.price, changePercent: q.changePercent, score: s });
  }
  fast.sort((a, b) => b.score - a.score);
  const candidates = fast.slice(0, 14).map((f) => f.symbol);
  funnel.fastRows = fast.length;
  funnel.candidates = candidates.length;

  // 2) Derin analiz: ATR, destek/direnç, EMA yapısı (paralel, 6 aylık geçmiş)
  const histResults = await Promise.all(
    candidates.map(async (sym) => {
      const h = await getHistory(sym, "6mo", "1d");
      return { sym, hist: h.data };
    })
  );

  const cands: CandRow[] = [];
  for (const { sym, hist } of histResults) {
    const q = quotes[sym];
    const meta = BIST_UNIVERSE.find((s) => s.symbol === sym);
    if (!q || !meta || !hist || hist.candles.length < 60) continue;
    funnel.histOk = (funnel.histOk as number) + 1;
    const ind = computeIndicators(hist.candles);
    const { supports, resistances } = findLevels(hist.candles, ind.price);
    const ex = tvCachedExtra(sym) ?? {};
    const fastScore = fast.find((f) => f.symbol === sym)?.score ?? 50;
    cands.push({ symbol: sym, name: meta.name, sector: meta.sector, price: q.price, changePercent: q.changePercent, extra: ex, candles: hist.candles, ind, supports, resistances, fastScore });
  }

  // 3) Seçim üretimi — yalnızca yükseliş yapısı uygun olanlar
  const picks: DailyPick[] = [];
  for (const c of cands) {
    const atr = c.ind.atr14;
    if (atr == null || atr <= 0) continue;
    const price = c.price;
    const atrPct = (atr / price) * 100;
    if (atrPct > 9) continue; // aşırı volatil — günlük hedef anlamsız

    const res1 = c.resistances[0]?.price ?? null;
    const sup1 = c.supports[0]?.price ?? null;

    // Yükseliş yapısı koşulları (en az 2'si sağlanmalı):
    const aboveEma20 = c.ind.ema20 != null && price > c.ind.ema20;
    const emaStack = c.ind.ema20 != null && c.ind.ema50 != null && c.ind.ema20 > c.ind.ema50;
    const macdPos = (c.ind.macdHist ?? 0) > 0;
    const macdRising = c.ind.macdHist != null && c.ind.macdHistPrev != null && c.ind.macdHist > c.ind.macdHistPrev;
    const rsiOK = (c.ind.rsi14 ?? 50) > 45 && (c.ind.rsi14 ?? 50) < 72;
    const adxOK = (c.ind.adx14 ?? 0) > 18 && (c.ind.plusDI ?? 0) > (c.ind.minusDI ?? 0);
    const nearRes = res1 != null && res1 > price && (res1 - price) / price < 0.05;
    const oversoldTurn = (c.ind.rsi14 ?? 50) < 38 && macdRising && c.changePercent > -0.5;

    const structure = [aboveEma20 && emaStack, macdPos && macdRising, rsiOK, adxOK, oversoldTurn].filter(Boolean).length;
    if (structure < 2 && !oversoldTurn) {
      (funnel.drops as string[]).push(`${c.symbol}: yapı=${structure} ema=${aboveEma20}/${emaStack} macd=${macdPos}/${macdRising} rsi=${c.ind.rsi14?.toFixed(1)} adx=${c.ind.adx14?.toFixed(0)}+${c.ind.plusDI?.toFixed(0)}/${c.ind.minusDI?.toFixed(0)}`);
      continue;
    }
    funnel.structure = (funnel.structure as number) + 1;

    // Hedefler — ATR tabanlı. Dirence bitişikse KIRILIM senaryosu, değilse dirence kadar kırpılır.
    const gapRes = res1 != null && res1 > price ? res1 - price : null;
    const nearBreakout = gapRes != null && gapRes / price < 0.012;
    let todayTarget: number;
    let todayTargetHigh: number;
    let stopLoss: number;
    if (nearBreakout) {
      // Direnci hacimle kırarsa direncin ötesi ATR hareketi açılır
      todayTarget = res1! + atr * 0.6;
      todayTargetHigh = res1! + atr * 1.0;
      stopLoss = price - atr * 0.75;
    } else {
      todayTarget = price + atr * 0.7;
      if (gapRes != null) todayTarget = Math.min(todayTarget, price + gapRes * 0.75);
      todayTargetHigh = gapRes != null ? Math.min(price + atr * 1.15, res1! * 0.999) : price + atr * 1.15;
      stopLoss = price - atr * 0.85;
    }
    if (todayTarget <= price * 1.004) {
      (funnel.drops as string[]).push(`${c.symbol}: hedef yakın (${todayTarget.toFixed(2)} vs ${price.toFixed(2)}) res1=${res1?.toFixed(2)}`);
      continue;
    }
    funnel.targetOk = (funnel.targetOk as number) + 1;

    // Haftalık hedef — kırılımda direncin ötesi, normalde dirence kadar
    let weekTarget: number;
    if (nearBreakout) {
      weekTarget = res1! + atr * 1.6;
    } else {
      weekTarget = price + atr * 1.6;
      if (gapRes != null && res1! > price * 1.02) weekTarget = Math.min(weekTarget, price + gapRes * 0.9);
      weekTarget = Math.max(weekTarget, todayTarget * 1.005);
    }

    // Stop — yalnızca destek daha SIKI bir stop veriyorsa destek altına çekilir
    if (!nearBreakout && sup1 != null && sup1 < price) {
      const supStop = Math.max(sup1 * 0.995, price * 0.95); // en fazla %5 risk
      if (supStop > stopLoss) stopLoss = Math.min(supStop, price * 0.985); // en az %1.5 mesafe
    } else {
      stopLoss = Math.max(stopLoss, price * 0.95);
      stopLoss = Math.min(stopLoss, price * 0.985);
    }

    const risk = price - stopLoss;
    const reward = todayTarget - price;
    const riskReward = risk > 0 ? r2(reward / risk) : 0;
    if (riskReward < 0.7) {
      (funnel.drops as string[]).push(`${c.symbol}: R/R=${riskReward} risk=${risk.toFixed(2)} ödül=${reward.toFixed(2)}`);
      continue;
    }
    funnel.rrOk = (funnel.rrOk as number) + 1;

    // Güven skoru — yapı + momentum + hacim + trend teyidi + rejim
    let confidence = 38;
    confidence += structure * 7; // 0-35
    if (c.extra.relVolume != null && c.extra.relVolume > 1.3) confidence += 8;
    else if (c.extra.relVolume != null && c.extra.relVolume > 1.0) confidence += 3;
    if ((c.extra.perfWeek ?? 0) > 2) confidence += 6;
    else if ((c.extra.perfWeek ?? 0) > 0) confidence += 2;
    if (adxOK) confidence += 5;
    if (regime.type === "yukselis" || regime.type === "guclu_yukselis") confidence += 6;
    else if (regime.type === "dusus" || regime.type === "panik") confidence -= 8;
    else if (regime.type === "dalgalı") confidence += 1;
    if (c.changePercent < -2) confidence -= 6;
    confidence = Math.max(20, Math.min(88, Math.round(confidence)));

    const todayTargetPct = ((todayTarget - price) / price) * 100;
    const todayTargetHighPct = ((todayTargetHigh - price) / price) * 100;
    const weekTargetPct = ((weekTarget - price) / price) * 100;
    const profitPer100 = r2((todayTargetPct / 100) * 100);
    const profitPer100High = r2((todayTargetHighPct / 100) * 100);

    // Gerekçe — net, anlaşılır Türkçe
    const bits: string[] = [];
    if (nearBreakout && res1 != null) bits.push(`${r2(res1)} TL direncine bitişik — ${r2(res1)} TL üzeri hacimli kırılımda hedef ${roundTick(todayTarget)} TL`);
    if (aboveEma20 && emaStack) bits.push("fiyat kısa vadeli ortalamaların üzerinde, yükseliş düzeni var");
    if (macdPos && macdRising) bits.push("MACD pozitif bölgede güçleniyor");
    if ((c.extra.relVolume ?? 1) > 1.3) bits.push(`hacim ortalamanın %${Math.round((c.extra.relVolume ?? 1) * 100)}'inde — alıcı ilgisi güçlü`);
    if (adxOK) bits.push("trend gücü (ADX) yukarı yönü doğruluyor");
    if (oversoldTurn) bits.push("aşırı satım bölgesinden dönüş sinyali başladı");
    if (!nearBreakout && nearRes && res1 != null) bits.push(`${r2(res1)} TL direncine yakın — hedefe mesafe kısa`);
    const reason = bits.length > 0 ? bits.join("; ").replace(/^./, (m) => m.toLocaleUpperCase("tr-TR")) + "." : "Teknik göstergeler yukarı yönlü uyum gösteriyor.";

    const invalidation = nearBreakout && res1 != null
      ? `${r2(res1)} TL direnci kırılamadan ${r2(stopLoss)} TL stop seviyesine inilirse kırılım senaryosu geçersizdir.`
      : sup1 != null
        ? `${r2(sup1)} TL destek seviyesi gün içinde hacimli şekilde kırılırsa bu seçim geçersizdir; stop ${r2(stopLoss)} TL.`
        : `Stop ${r2(stopLoss)} TL — bu seviyenin altına inilirse senaryo geçersizdir.`;

    picks.push({
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
      price: r2(price),
      changePercent: r2(c.changePercent),
      direction: "YÜKSELİŞ",
      todayTarget: roundTick(todayTarget),
      todayTargetHigh: roundTick(todayTargetHigh),
      todayTargetPct: r2(todayTargetPct),
      todayTargetHighPct: r2(todayTargetHighPct),
      weekTarget: roundTick(weekTarget),
      weekTargetPct: r2(weekTargetPct),
      entryLow: roundTick(price * 0.998),
      entryHigh: roundTick(price * 1.006),
      stopLoss: roundTick(stopLoss),
      riskReward,
      confidence,
      profitPer100,
      profitPer100High,
      reason,
      invalidation,
      rsi: c.ind.rsi14 != null ? r2(c.ind.rsi14) : null,
      volumeRatio: c.ind.volRatio != null ? r2(c.ind.volRatio) : null,
      perfWeek: c.extra.perfWeek != null ? r2(c.extra.perfWeek) : null,
      distanceResistancePct: res1 != null && res1 > price ? r2(((res1 - price) / price) * 100) : null,
    });
  }

  picks.sort((a, b) => b.confidence - a.confidence);
  const top = picks.slice(0, 5);

  // 4) Bugün uzak durulacaklar — açık zayıflık
  const avoid: AvoidItem[] = Object.values(quotes)
    .filter((q) => q.changePercent < -2.5)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3)
    .map((q) => {
      const meta = BIST_UNIVERSE.find((s) => s.symbol === q.symbol);
      return {
        symbol: q.symbol,
        name: meta?.name ?? q.symbol,
        price: r2(q.price),
        changePercent: r2(q.changePercent),
        reason: `Bugün %${Math.abs(r2(q.changePercent))} düşüşte, satış baskısı sürüyor — yeni pozisyon açmak yerine izlenmesi uygun.`,
      };
    });

  const ms = bistMarketStatus();
  const headline = top.length > 0
    ? `Ajan bugün ${top.length} hissede yükseliş fırsatı tespit etti — en güçlüsü ${top[0].symbol} (hedef ${top[0].todayTarget} TL, +%${top[0].todayTargetPct})`
    : "Bugün yeterli güvene sahip yükseliş fırsatı bulunamadı — piyasada net yön yok, beklemek daha güvenli.";

  const result: PicksResponse = {
    generatedAt: Date.now(),
    marketStatus: ms,
    picks: top,
    avoid,
    regime,
    headline,
    sourceNote: "Fiyatlar: TradingView Türkiye — resmî BIST borsa verisi (Midas'ta görüntülenenle aynı). Hedefler ATR ve destek/direnç seviyelerinden hesaplanmıştır.",
    disclaimer: "Hedefler olasılıksal senaryodur, garanti değildir. Her seçimde stop seviyesi ve geçersizlik koşulu belirtilmiştir. Yatırım tavsiyesi değildir.",
  };
  cacheSet(CACHE_KEY, result, 3 * 60_000);
  return debug ? { ...result, debug: funnel } : result;
}
