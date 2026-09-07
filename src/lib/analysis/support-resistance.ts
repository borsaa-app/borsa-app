/**
 * Destek/Direnç Tespiti — pivot tabanlı + fiyat bantları
 * Gerçek geçmiş fiyat verisi üzerinden hesaplanır.
 */

import type { Candle } from "@/lib/market/providers";

export interface Level {
  price: number;
  strength: number; // kaç kez temas / ne kadar güçlü (1-5)
  type: "support" | "resistance";
  lastTouchIndex: number;
  touches: number;
}

export function findLevels(candles: Candle[], price: number): { supports: Level[]; resistances: Level[] } {
  const lookback = Math.min(candles.length, 180);
  const data = candles.slice(-lookback);
  const highs = data.map((c) => c.high);
  const lows = data.map((c) => c.low);
  const pivotWindow = 3;
  const clusters: Array<{ price: number; touches: number; lastIdx: number }> = [];

  // Pivot yüksek/düşük noktaları bul
  const pivots: Array<{ price: number; idx: number }> = [];
  for (let i = pivotWindow; i < data.length - pivotWindow; i++) {
    const isHigh = highs.slice(i - pivotWindow, i + pivotWindow + 1).every((v, j) => j === pivotWindow || v <= highs[i]);
    const isLow = lows.slice(i - pivotWindow, i + pivotWindow + 1).every((v, j) => j === pivotWindow || v >= lows[i]);
    if (isHigh) pivots.push({ price: highs[i], idx: i });
    if (isLow) pivots.push({ price: lows[i], idx: i });
  }

  // Yakın pivotları kümele (fiyatın %1.5'i tolerans)
  const tolerance = price * 0.015;
  for (const p of pivots) {
    const found = clusters.find((c) => Math.abs(c.price - p.price) < tolerance);
    if (found) {
      found.price = (found.price * found.touches + p.price) / (found.touches + 1);
      found.touches++;
      found.lastIdx = Math.max(found.lastIdx, p.idx);
    } else {
      clusters.push({ price: p.price, touches: 1, lastIdx: p.idx });
    }
  }

  // 52 hafta zirve/dip de önemli seviyelerdir
  const w52 = data.slice(-252);
  if (w52.length > 30) {
    clusters.push({ price: Math.max(...w52.map((c) => c.high)), touches: 3, lastIdx: data.length - 1 });
    clusters.push({ price: Math.min(...w52.map((c) => c.low)), touches: 3, lastIdx: data.length - 1 });
  }

  const levels: Level[] = clusters.map((c) => ({
    price: c.price,
    strength: Math.min(5, c.touches),
    type: c.price > price ? "resistance" : "support",
    lastTouchIndex: c.lastIdx,
    touches: c.touches,
  }));

  const supports = levels
    .filter((l) => l.type === "support")
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);
  const resistances = levels
    .filter((l) => l.type === "resistance")
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);

  return { supports, resistances };
}

export type RegimeType = "guclu_yukselis" | "yukselis" | "yatay" | "dalgalı" | "dusus" | "panik";

export interface Regime {
  type: RegimeType;
  label: string;
  description: string;
  bist100Change: number;
  bist100Trend: "yukari" | "asagi" | "yatay";
  volatilityLevel: "düşük" | "orta" | "yüksek";
  momentumScore: number; // -100..100
  advice: string;
}

export function detectRegime(bist100History: Candle[]): Regime {
  const closes = bist100History.map((c) => c.close);
  const n = closes.length;
  const price = closes[n - 1];

  const ret20 = n > 20 ? ((price - closes[n - 21]) / closes[n - 21]) * 100 : 0;
  const ret60 = n > 60 ? ((price - closes[n - 61]) / closes[n - 61]) * 100 : 0;

  const rets: number[] = [];
  for (let i = Math.max(1, n - 20); i < n; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const std = rets.length > 1 ? Math.sqrt(rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (rets.length - 1)) : 0;
  const annVol = std * Math.sqrt(252) * 100;

  const volatilityLevel: Regime["volatilityLevel"] = annVol > 35 ? "yüksek" : annVol > 20 ? "orta" : "düşük";

  let type: RegimeType;
  if (annVol > 40 && ret20 < -5) type = "panik";
  else if (ret20 > 5 && ret60 > 10) type = "guclu_yukselis";
  else if (ret20 > 1) type = "yukselis";
  else if (ret20 < -5 && ret60 < -10) type = "dusus";
  else if (annVol > 30) type = "dalgalı";
  else type = "yatay";

  const labels: Record<RegimeType, string> = {
    guclu_yukselis: "GÜÇLÜ YÜKSELİŞ",
    yukselis: "YÜKSELİŞ",
    yatay: "YATAY",
    dalgalı: "DALGALI",
    dusus: "DÜŞÜŞ",
    panik: "PANİK / YÜKSEK VOLATİLİTE",
  };
  const descriptions: Record<RegimeType, string> = {
    guclu_yukselis: "BIST 100 net yükseliş trendinde. Momentum stratejileri için elverişli bir dönem.",
    yukselis: "Endeks ılımlı bir yükseliş içinde. Trend takibi avantajlı, ancak aşırı uzayan hareketlere dikkat edilmeli.",
    yatay: "Endeks belirgin bir yön yakalayamamış durumda. Seçici olmak ve kırılım beklemek makul.",
    dalgalı: "Yükselen volatilite ile yön arayan bir piyasa. Pozisyon boyutlarında temkinli olunmalı.",
    dusus: "Endeks düşüş trendinde. Alım fırsatları puanlanırken temkin uygulandı; stop seviyeleri kritik.",
    panik: "Yüksek volatilite ve sert satış baskısı mevcut. Nakit oranı yükseltmek ve kademeli hareket etmek önceliklidir.",
  };
  const advices: Record<RegimeType, string> = {
    guclu_yukselis: "Momentum güçlü hisselerde trend devamı fırsatları ağırlıklandırıldı.",
    yukselis: "Geri çekilmeler kademeli alım için izlenebilir; trendin bozulmadığını doğrulayın.",
    yatay: "Destek bölgesindeki alımlar, direnç bölgesindeki satırlar makul stratejiler.",
    dalgalı: "Pozisyon boyutunu küçültün; stop mesafelerini volatiliteye göre genişletin (ATR).",
    dusus: "Alım sinyallerinin ağırlığı düşürüldü. Trend dönüş teyidi olmadan agresif olmayın.",
    panik: "Sadece çok güçlü risk/getiri profilleri öne çıkarıldı. Kademeli giriş mantıklıdır.",
  };

  const momentumScore = Math.max(-100, Math.min(100, ret20 * 8 + ret60 * 2));

  return {
    type,
    label: labels[type],
    description: descriptions[type],
    bist100Change: ret20,
    bist100Trend: ret20 > 1 ? "yukari" : ret20 < -1 ? "asagi" : "yatay",
    volatilityLevel,
    momentumScore,
    advice: advices[type],
  };
}

/** Rejime göre dinamik skor ağırlıkları */
export function dynamicWeights(regime: Regime): { technical: number; fundamentalProxy: number; momentum: number; volume: number; news: number; sector: number; risk: number } {
  const base = { technical: 25, fundamentalProxy: 25, momentum: 15, volume: 10, news: 10, sector: 10, risk: 5 };
  if (regime.type === "guclu_yukselis") {
    return { technical: 25, fundamentalProxy: 20, momentum: 22, volume: 10, news: 8, sector: 10, risk: 5 };
  }
  if (regime.type === "dusus" || regime.type === "panik") {
    return { technical: 22, fundamentalProxy: 28, momentum: 8, volume: 8, news: 12, sector: 10, risk: 12 };
  }
  if (regime.type === "dalgalı") {
    return { technical: 20, fundamentalProxy: 27, momentum: 10, volume: 10, news: 10, sector: 10, risk: 13 };
  }
  // toplam 100 kuralı
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const norm = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, (v / total) * 100]));
  return norm as typeof base;
}
