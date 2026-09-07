/**
 * Teknik Analiz Göstergeleri
 * Tüm değerler gerçek OHLCV verisinden hesaplanır. Uydurma veri yoktur.
 */

import type { Candle } from "@/lib/market/providers";

export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i === period - 1) {
      prev = sum / period;
      out.push(prev);
    } else if (i >= period) {
      prev = values[i] * k + (prev as number) * (1 - k);
      out.push(prev);
    } else {
      out.push(null);
    }
  }
  return out;
}

export function rsi(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period;
    avgL = (avgL * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export function macd(closes: number[], fast = 12, slow = 26, signalP = 9): { macd: Array<number | null>; signal: Array<number | null>; histogram: Array<number | null> } {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const macdLine: Array<number | null> = closes.map((_, i) => (ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null));
  const valid = macdLine.filter((v) => v != null) as number[];
  const sigValid = ema(valid, signalP);
  const signal: Array<number | null> = [];
  const histogram: Array<number | null> = [];
  let vi = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] == null) {
      signal.push(null);
      histogram.push(null);
    } else {
      const s = sigValid[vi];
      signal.push(s);
      histogram.push(s != null ? (macdLine[i] as number) - s : null);
      vi++;
    }
  }
  return { macd: macdLine, signal, histogram };
}

export function bollinger(closes: number[], period = 20, mult = 2): { upper: Array<number | null>; middle: Array<number | null>; lower: Array<number | null>; bandwidth: Array<number | null> } {
  const mid = sma(closes, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  const bandwidth: Array<number | null> = [];
  for (let i = 0; i < closes.length; i++) {
    if (mid[i] == null) {
      upper.push(null);
      lower.push(null);
      bandwidth.push(null);
      continue;
    }
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += Math.pow(closes[j] - (mid[i] as number), 2);
    const sd = Math.sqrt(sq / period);
    const u = (mid[i] as number) + mult * sd;
    const l = (mid[i] as number) - mult * sd;
    upper.push(u);
    lower.push(l);
    bandwidth.push((u - l) / (mid[i] as number) * 100);
  }
  return { upper, middle: mid, lower, bandwidth };
}

export function atr(candles: Candle[], period = 14): Array<number | null> {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const pc = candles[i - 1].close;
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - pc), Math.abs(candles[i].low - pc)));
  }
  return ema(trs, period);
}

export function adx(candles: Candle[], period = 14): { adx: Array<number | null>; plusDI: Array<number | null>; minusDI: Array<number | null> } {
  const len = candles.length;
  const plusDM: number[] = new Array(len).fill(0);
  const minusDM: number[] = new Array(len).fill(0);
  const tr: number[] = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const dn = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
    const pc = candles[i - 1].close;
    tr[i] = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - pc), Math.abs(candles[i].low - pc));
  }
  const smooth = (arr: number[], p: number): Array<number | null> => {
    const out: Array<number | null> = new Array(len).fill(null);
    let s = 0;
    for (let i = 1; i <= p && i < len; i++) s += arr[i];
    if (p < len) out[p] = s;
    for (let i = p + 1; i < len; i++) {
      s = s - (out[i - 1] as number) / p + arr[i];
      out[i] = s;
    }
    return out;
  };
  const sTR = smooth(tr, period);
  const sP = smooth(plusDM, period);
  const sM = smooth(minusDM, period);
  const plusDI: Array<number | null> = new Array(len).fill(null);
  const minusDI: Array<number | null> = new Array(len).fill(null);
  const dx: Array<number | null> = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    if (sTR[i] != null && sTR[i] !== 0) {
      plusDI[i] = (100 * (sP[i] as number)) / (sTR[i] as number);
      minusDI[i] = (100 * (sM[i] as number)) / (sTR[i] as number);
      const sum = (plusDI[i] as number) + (minusDI[i] as number);
      dx[i] = sum === 0 ? 0 : (100 * Math.abs((plusDI[i] as number) - (minusDI[i] as number))) / sum;
    }
  }
  // ADX = EMA(DX, period)
  const dxValid = dx.filter((v) => v != null) as number[];
  const adxValid = ema(dxValid, period);
  const adx: Array<number | null> = new Array(len).fill(null);
  let vi = 0;
  for (let i = 0; i < len; i++) {
    if (dx[i] != null) {
      adx[i] = adxValid[vi] ?? null;
      vi++;
    }
  }
  return { adx, plusDI, minusDI };
}

export function stochastic(candles: Candle[], period = 14, smoothK = 3, smoothD = 3): { k: Array<number | null>; d: Array<number | null> } {
  const len = candles.length;
  const raw: Array<number | null> = new Array(len).fill(null);
  for (let i = period - 1; i < len; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    raw[i] = hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100;
  }
  const rv = raw.filter((v) => v != null) as number[];
  const kv = sma(rv, smoothK);
  const dv = sma(kv.filter((v) => v != null) as number[], smoothD);
  const k: Array<number | null> = new Array(len).fill(null);
  const d: Array<number | null> = new Array(len).fill(null);
  let ki = 0;
  let di = 0;
  for (let i = 0; i < len; i++) {
    if (raw[i] != null) {
      k[i] = kv[ki] ?? null;
      // d değerini k'nın smoothed haliyle hizala
      if (kv[ki] != null) {
        d[i] = dv[Math.max(0, di)] ?? null;
        di++;
      }
      ki++;
    }
  }
  return { k, d };
}

export function vwap(candles: Candle[], period = 20): Array<number | null> {
  const out: Array<number | null> = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    let pv = 0;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
      pv += tp * candles[j].volume;
      v += candles[j].volume;
    }
    out[i] = v > 0 ? pv / v : (candles[i].high + candles[i].low + candles[i].close) / 3;
  }
  return out;
}

export function obv(candles: Candle[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const prev = out[i - 1];
    if (candles[i].close > candles[i - 1].close) out.push(prev + candles[i].volume);
    else if (candles[i].close < candles[i - 1].close) out.push(prev - candles[i].volume);
    else out.push(prev);
  }
  return out;
}

/** Volatilite: yıllıklandırılmış günlük getirinin standart sapması (%) */
export function annualizedVolatility(closes: number[], period = 30): number | null {
  if (closes.length < period + 1) return null;
  const rets: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (rets.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

export interface IndicatorSnapshot {
  price: number;
  rsi14: number | null;
  rsiPrev: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  macdHistPrev: number | null;
  ema20: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  sma20: number | null;
  sma50: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbBandwidth: number | null;
  bbPercentB: number | null;
  atr14: number | null;
  atrPercent: number | null;
  adx14: number | null;
  plusDI: number | null;
  minusDI: number | null;
  stochK: number | null;
  stochD: number | null;
  vwap20: number | null;
  obvSlope: number | null;
  volAvg20: number | null;
  volLast: number | null;
  volRatio: number | null;
  annVol: number | null;
  ret5d: number | null;
  ret20d: number | null;
  ret60d: number | null;
  week52High: number | null;
  week52Low: number | null;
  from52High: number | null;
}

export function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume);
  const n = closes.length;
  const price = closes[n - 1];

  const r = rsi(closes, 14);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const a = atr(candles, 14);
  const ax = adx(candles, 14);
  const st = stochastic(candles);
  const vw = vwap(candles, 20);
  const ob = obv(candles);

  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e100 = ema(closes, 100);
  const e200 = ema(closes, 200);
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);

  const volAvg20 = vols.slice(-20).reduce((x, y) => x + y, 0) / Math.min(20, vols.length) || null;
  const volLast = vols[n - 1] ?? null;

  const obvSlope =
    ob.length > 20
      ? (() => {
          const recent = ob.slice(-10);
          const older = ob.slice(-20, -10);
          const avg = (arr: number[]) => arr.reduce((x, y) => x + y, 0) / arr.length;
          const denom = Math.abs(avg(older)) || 1;
          return ((avg(recent) - avg(older)) / denom) * 100;
        })()
      : null;

  const bbPctB = bb.upper[n - 1] != null && bb.lower[n - 1] != null && bb.upper[n - 1] !== bb.lower[n - 1]
    ? ((price - (bb.lower[n - 1] as number)) / ((bb.upper[n - 1] as number) - (bb.lower[n - 1] as number))) * 100
    : null;

  const w52 = candles.slice(-252);
  const w52High = w52.length ? Math.max(...w52.map((c) => c.high)) : null;
  const w52Low = w52.length ? Math.min(...w52.map((c) => c.low)) : null;

  const pctChange = (days: number) => (n > days ? ((price - closes[n - 1 - days]) / closes[n - 1 - days]) * 100 : null);

  return {
    price,
    rsi14: r[n - 1],
    rsiPrev: n > 1 ? r[n - 2] : null,
    macd: m.macd[n - 1],
    macdSignal: m.signal[n - 1],
    macdHist: m.histogram[n - 1],
    macdHistPrev: n > 1 ? m.histogram[n - 2] : null,
    ema20: e20[n - 1],
    ema50: e50[n - 1],
    ema100: e100[n - 1],
    ema200: e200[n - 1],
    sma20: s20[n - 1],
    sma50: s50[n - 1],
    bbUpper: bb.upper[n - 1],
    bbMiddle: bb.middle[n - 1],
    bbLower: bb.lower[n - 1],
    bbBandwidth: bb.bandwidth[n - 1],
    bbPercentB: bbPctB,
    atr14: a[n - 1],
    atrPercent: a[n - 1] != null ? ((a[n - 1] as number) / price) * 100 : null,
    adx14: ax.adx[n - 1],
    plusDI: ax.plusDI[n - 1],
    minusDI: ax.minusDI[n - 1],
    stochK: st.k[n - 1],
    stochD: st.d[n - 1],
    vwap20: vw[n - 1],
    obvSlope,
    volAvg20,
    volLast,
    volRatio: volAvg20 && volLast ? volLast / volAvg20 : null,
    annVol: annualizedVolatility(closes, 30),
    ret5d: pctChange(5),
    ret20d: pctChange(20),
    ret60d: pctChange(60),
    week52High: w52High,
    week52Low: w52Low,
    from52High: w52High ? ((price - w52High) / w52High) * 100 : null,
  };
}
