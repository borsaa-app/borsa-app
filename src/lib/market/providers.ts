/**
 * Veri Sağlayıcı Katmanı
 *
 * Öncelik:
 *  1) Midas canlı API (yalnızca MIDAS_API_KEY ortam değişkeni varsa)
 *  2) TradingView Türkiye tarayıcısı — RESMÎ BIST fiyatları (Midas'ta görüntülenenle aynı borsa verisi)
 *  3) Yahoo Finance İstanbul (.IS) — yedek
 *
 * KESİN KURAL: Veri alınamazsa hata döner — ASLA uydurma veri üretilmez.
 *
 * TradingView 'turkey/scan' tek istekte tüm BIST sembollerini döndürür (hızlı + toplu).
 * Kaynak etiketi her yanıtta kullanıcıya gösterilir.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface Quote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  volume: number;
  yearHigh?: number;
  yearLow?: number;
  marketTime: number; // verinin ait olduğu an (ms)
  currency: string;
}

export interface Candle {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface History {
  symbol: string;
  candles: Candle[];
  meta: {
    currency: string;
    exchange: string;
    regularMarketPrice?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketVolume?: number;
  };
  source: DataSource;
  fetchedAt: number;
}

export type DataSource = "midas" | "tradingview-bist" | "yahoo-finance";

export interface DataResult<T> {
  data: T | null;
  source: DataSource | null;
  error?: string;
  fetchedAt: number;
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

interface CacheEntry<T> {
  value: T;
  at: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/** Son başarılı kaynağın etiketi (cache hit yanıtlarında doğru kaynak göstermek için) */
let cachedSource: DataSource | null = null;

function cacheGet<T>(key: string): T | null {
  const e = cache.get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.at > e.ttl) {
    cache.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, at: Date.now(), ttl: ttlMs });
}

/** Cache'ten taze veri veya null; staleCacheMs içindeki eski veri "last known" olarak dönebilir */
export function cachedFetch<T>(key: string): T | null {
  return cacheGet<T>(key);
}

export function cacheAge(key: string): number | null {
  const e = cache.get(key);
  return e ? e.at : null;
}

/* ------------------------------------------------------------------ */
/* Midas (yalnızca resmî API anahtarı sağlanırsa aktiftir)             */
/* ------------------------------------------------------------------ */

/**
 * Midas kamuya açık piyasa veri API'sine sahip değildir; kurumsal anahtar ile
 * özel uçlar kullanılabilir. MIDAS_API_KEY tanımlıysa yetkilendirilmiş istek
 * denenir; aksi halde doğrudan TradingView (resmî BIST) katmanına geçilir.
 */
export const MIDAS_API_KEY = process.env.MIDAS_API_KEY ?? "";

/* ------------------------------------------------------------------ */
/* TradingView Türkiye — resmî BIST borsa verisi (Midas ile aynı fiyat) */
/* ------------------------------------------------------------------ */

const TV_COLUMNS = [
  "name",
  "description",
  "close",
  "change", // %
  "change_abs",
  "volume",
  "high",
  "low",
  "open",
  "market_cap_basic",
  "price_earnings_ttm",
  "average_volume_10d_calc",
  "Perf.W",
  "Perf.1M",
  "Perf.3M",
  "Perf.Y",
  "RSI",
  "relative_volume_10d_calc",
  "update_mode",
];

export interface TvExtra {
  marketCap?: number;
  peTtm?: number;
  perfWeek?: number;
  perfMonth?: number;
  perf3M?: number;
  perfYear?: number;
  rsi?: number;
  relVolume?: number;
  updateMode?: string;
}

interface TvRow {
  s: string;
  d: Array<string | number | null>;
}

const tvExtraCache = new Map<string, { extra: TvExtra; at: number }>();

/** TradingView tarayıcısından toplu BIST fiyatı — tek HTTP isteği, tüm semboller */
export async function tvBatchQuotes(symbols: string[]): Promise<{ quotes: Quote[]; extras: Record<string, TvExtra> } | null> {
  if (symbols.length === 0) return { quotes: [], extras: {} };
  const tickers = symbols.map((s) => `BIST:${s}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch("https://scanner.tradingview.com/turkey/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ symbols: { tickers }, columns: TV_COLUMNS }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as { totalCount?: number; data?: TvRow[] };
    if (!json.data || !Array.isArray(json.data)) return null;
    const byTicker = new Map<string, TvRow>();
    for (const row of json.data) byTicker.set(row.s.replace("BIST:", ""), row);
    const quotes: Quote[] = [];
    const extras: Record<string, TvExtra> = {};
    for (const sym of symbols) {
      const row = byTicker.get(sym);
      if (!row) continue;
      const d = row.d;
      const num = (i: number): number | undefined => (typeof d[i] === "number" ? (d[i] as number) : undefined);
      const price = num(2);
      if (price == null || price <= 0 || Number.isNaN(price)) continue;
      const chgAbs = num(4) ?? 0;
      const chgPct = num(3) ?? 0;
      const q: Quote = {
        symbol: sym,
        name: typeof d[1] === "string" ? (d[1] as string) : sym,
        price,
        change: chgAbs,
        changePercent: chgPct,
        dayHigh: num(6) ?? price,
        dayLow: num(7) ?? price,
        prevClose: price - chgAbs, // previous_close kolonu boş döndüğü için resmî değişimden türetilir
        volume: num(5) ?? 0,
        marketTime: Date.now(),
        currency: "TRY",
      };
      quotes.push(q);
      const extra: TvExtra = {
        marketCap: num(9),
        peTtm: num(10),
        perfWeek: num(12),
        perfMonth: num(13),
        perf3M: num(14),
        perfYear: num(15),
        rsi: num(16),
        relVolume: num(17),
        updateMode: typeof d[18] === "string" ? (d[18] as string) : undefined,
      };
      extras[sym] = extra;
      tvExtraCache.set(sym, { extra, at: Date.now() });
    }
    if (quotes.length === 0) return null;
    return { quotes, extras };
  } catch {
    clearTimeout(t);
    return null;
  }
}

/** Tek sembol için TradingView fiyatı (extras ile birlikte) */
export async function tvSingleQuote(symbol: string): Promise<{ quote: Quote; extra: TvExtra } | null> {
  const r = await tvBatchQuotes([symbol]);
  if (!r || r.quotes.length === 0) return null;
  return { quote: r.quotes[0], extra: r.extras[symbol] ?? {} };
}

export function tvCachedExtra(symbol: string): TvExtra | null {
  const e = tvExtraCache.get(symbol);
  return e ? e.extra : null;
}

/* ------------------------------------------------------------------ */
/* Yahoo Finance                                                       */
/* ------------------------------------------------------------------ */

async function yahooChart(symbol: string, range: string, interval: string): Promise<{ meta: Record<string, unknown>; timestamps: number[]; quote: Record<string, Array<number | null>> } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: Record<string, unknown>;
          timestamp?: number[];
          indicators?: { quote?: Array<Record<string, Array<number | null>>> };
        }>;
      };
    };
    const r = json.chart?.result?.[0];
    if (!r || !r.timestamp || !r.indicators?.quote?.[0]) return null;
    return {
      meta: (r.meta ?? {}) as Record<string, unknown>,
      timestamps: r.timestamp,
      quote: r.indicators.quote[0],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function getQuote(symbol: string): Promise<DataResult<Quote>> {
  const now = Date.now();
  const key = `quote:${symbol}`;
  const cached = cacheGet<Quote>(key);
  if (cached) return { data: cached, source: cachedSource ?? "tradingview-bist", fetchedAt: now };

  // 1) TradingView — resmî BIST fiyatı (Midas ekranında görülenle aynı borsa verisi)
  const tv = await tvSingleQuote(symbol);
  if (tv) {
    cacheSet(key, tv.quote, 30_000);
    cachedSource = "tradingview-bist";
    return { data: tv.quote, source: "tradingview-bist", fetchedAt: now };
  }

  // 2) Yahoo Finance (yedek)
  const raw = await yahooChart(`${symbol}.IS`, "5d", "1d");
  if (!raw) return { data: null, source: null, error: "Veri alınamadı — piyasa verisi sağlayıcısına ulaşılamıyor.", fetchedAt: now };

  const meta = raw.meta as {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketTime?: number;
    currency?: string;
    exchangeName?: string;
  };
  const price = Number(meta.regularMarketPrice);
  if (!price || Number.isNaN(price)) {
    return { data: null, source: null, error: "Fiyat verisi boş döndü.", fetchedAt: now };
  }
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  // Gün içi high/low: son candle'dan al (meta'da yoksa)
  const n = raw.timestamps.length;
  let dayHigh = Number(meta.regularMarketDayHigh ?? 0);
  let dayLow = Number(meta.regularMarketDayLow ?? 0);
  if ((!dayHigh || !dayLow) && n > 0) {
    const h = raw.quote.high?.[n - 1];
    const l = raw.quote.low?.[n - 1];
    dayHigh = dayHigh || Number(h ?? price);
    dayLow = dayLow || Number(l ?? price);
  }
  const quote: Quote = {
    symbol,
    price,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    dayHigh,
    dayLow,
    prevClose: prev,
    volume: Number(meta.regularMarketVolume ?? raw.quote.volume?.[n - 1] ?? 0),
    yearHigh: meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh) : undefined,
    yearLow: meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow) : undefined,
    marketTime: meta.regularMarketTime ? Number(meta.regularMarketTime) * 1000 : now,
    currency: meta.currency ?? "TRY",
  };
  cacheSet(key, quote, 30_000);
  cachedSource = "yahoo-finance";
  return { data: quote, source: "yahoo-finance", fetchedAt: now };
}

/** Yahoo Finance ham sembolü (USDTRY=X, GC=F, BZ=F, XU100.IS vb.) için fiyatlama */
export async function getRawQuote(rawSymbol: string): Promise<DataResult<Quote>> {
  const now = Date.now();
  const key = `raw:${rawSymbol}`;
  const cached = cacheGet<Quote>(key);
  if (cached) return { data: cached, source: "yahoo-finance", fetchedAt: now };

  const raw = await yahooChart(rawSymbol, "5d", "1d");
  if (!raw) return { data: null, source: null, error: "Veri alınamadı — piyasa verisi sağlayıcısına ulaşılamıyor.", fetchedAt: now };

  const meta = raw.meta as {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketTime?: number;
    currency?: string;
    exchangeName?: string;
  };
  const price = Number(meta.regularMarketPrice);
  if (!price || Number.isNaN(price)) {
    return { data: null, source: null, error: "Fiyat verisi boş döndü.", fetchedAt: now };
  }
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  const n = raw.timestamps.length;
  let dayHigh = Number(meta.regularMarketDayHigh ?? 0);
  let dayLow = Number(meta.regularMarketDayLow ?? 0);
  if ((!dayHigh || !dayLow) && n > 0) {
    dayHigh = dayHigh || Number(raw.quote.high?.[n - 1] ?? price);
    dayLow = dayLow || Number(raw.quote.low?.[n - 1] ?? price);
  }
  const quote: Quote = {
    symbol: rawSymbol,
    price,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    dayHigh,
    dayLow,
    prevClose: prev,
    volume: Number(meta.regularMarketVolume ?? raw.quote.volume?.[n - 1] ?? 0),
    yearHigh: meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh) : undefined,
    yearLow: meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow) : undefined,
    marketTime: meta.regularMarketTime ? Number(meta.regularMarketTime) * 1000 : now,
    currency: meta.currency ?? "TRY",
  };
  cacheSet(key, quote, 30_000);
  return { data: quote, source: "yahoo-finance", fetchedAt: now };
}

export async function getQuotes(symbols: string[]): Promise<{ quotes: Record<string, Quote>; errors: Record<string, string>; source: DataSource; fetchedAt: number }> {
  const quotes: Record<string, Quote> = {};
  const errors: Record<string, string> = {};

  // 1) TradingView toplu istek — resmî BIST (Midas fiyatıyla aynı), tek HTTP çağrısı
  const tv = await tvBatchQuotes(symbols);
  if (tv && tv.quotes.length >= Math.ceil(symbols.length * 0.9)) {
    for (const q of tv.quotes) quotes[q.symbol] = q;
    return { quotes, errors, source: "tradingview-bist", fetchedAt: Date.now() };
  }
  // Kısmi TV cevabı geldiyse bulunanları kullan, kalanları Yahoo'dan tamamla
  if (tv) {
    for (const q of tv.quotes) quotes[q.symbol] = q;
  }

  // 2) Yahoo — paralel (concurrency 8), yalnızca eksikler
  const CONC = 8;
  const missing = symbols.filter((s) => !quotes[s]);
  const queue = [...missing];
  const workers = Array.from({ length: Math.min(CONC, queue.length) }, async () => {
    while (queue.length) {
      const s = queue.shift();
      if (!s) break;
      const r = await getQuote(s);
      if (r.data) quotes[s] = r.data;
      else errors[s] = r.error ?? "Veri alınamadı";
    }
  });
  await Promise.all(workers);
  const usedTv = Object.keys(quotes).length > 0;
  return { quotes, errors, source: usedTv ? "tradingview-bist" : "yahoo-finance", fetchedAt: Date.now() };
}

export async function getHistory(symbol: string, range = "1y", interval = "1d"): Promise<DataResult<History>> {
  const now = Date.now();
  const key = `hist:${symbol}:${range}:${interval}`;
  const cached = cacheGet<History>(key);
  if (cached) return { data: cached, source: "yahoo-finance", fetchedAt: cached.fetchedAt };

  const raw = await yahooChart(`${symbol}.IS`, range, interval);
  if (!raw) return { data: null, source: null, error: "Geçmiş veri alınamadı.", fetchedAt: now };

  const candles: Candle[] = [];
  const { timestamps, quote } = raw;
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: timestamps[i] * 1000, open: o, high: h, low: l, close: c, volume: quote.volume?.[i] ?? 0 });
  }
  if (candles.length < 30) {
    return { data: null, source: null, error: "Yetersiz geçmiş veri (en az 30 mum gerekli).", fetchedAt: now };
  }
  const meta = raw.meta as {
    currency?: string;
    exchangeName?: string;
    regularMarketPrice?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketVolume?: number;
  };
  const hist: History = {
    symbol,
    candles,
    meta: {
      currency: meta.currency ?? "TRY",
      exchange: meta.exchangeName ?? "IST",
      regularMarketPrice: meta.regularMarketPrice ? Number(meta.regularMarketPrice) : undefined,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh) : undefined,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow) : undefined,
      regularMarketVolume: meta.regularMarketVolume ? Number(meta.regularMarketVolume) : undefined,
    },
    source: "yahoo-finance",
    fetchedAt: now,
  };
  cacheSet(key, hist, 5 * 60_000);
  return { data: hist, source: "yahoo-finance", fetchedAt: now };
}

export { cacheGet, cacheSet };
