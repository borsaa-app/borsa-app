/**
 * Veri Sağlayıcı Katmanı
 *
 * Öncelik: Midas canlı API (varsa) → Yahoo Finance İstanbul (BIST .IS)
 * KESİN KURAL: Veri alınamazsa hata döner — ASLA uydurma veri üretilmez.
 *
 * Yahoo Finance BIST verileri borsa açılış saatlerinde ~15 dk gecikmelidir.
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

export type DataSource = "midas" | "yahoo-finance";

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
/* Midas (canlı entegrasyon denemesi — kamuya açık uçlar kısıtlıdır)   */
/* ------------------------------------------------------------------ */

const MIDAS_ENDPOINTS = [
  "https://api.midas.com.tr/instruments",
  "https://midas.com.tr/api/market/stocks",
];

async function tryMidasQuotes(symbols: string[]): Promise<Quote[] | null> {
  // Midas'ın kamuya açık (kimliksiz) piyasa veri API'si bilinmemektedir.
  // Denenen uçlar cevap vermezse null döner ve Yahoo katmanına düşülür.
  for (const url of MIDAS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      if (!Array.isArray(json)) continue;
      // Basit eşleme denemesi — Midas şeması kamuya açık olmadığı için toleranslı parse
      const quotes: Quote[] = [];
      for (const sym of symbols) {
        const row = json.find(
          (r) => typeof r === "object" && r !== null && "symbol" in r && (r as { symbol?: string }).symbol === sym
        ) as Record<string, number | string> | undefined;
        if (row && typeof row.price === "number") {
          quotes.push({
            symbol: sym,
            price: row.price,
            change: Number(row.change ?? 0),
            changePercent: Number(row.changePercent ?? 0),
            dayHigh: Number(row.dayHigh ?? row.price),
            dayLow: Number(row.dayLow ?? row.price),
            prevClose: Number(row.prevClose ?? row.price),
            volume: Number(row.volume ?? 0),
            marketTime: Date.now(),
            currency: "TRY",
          });
        }
      }
      if (quotes.length === symbols.length) return quotes;
    } catch {
      continue;
    }
  }
  return null;
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
  if (cached) return { data: cached, source: "yahoo-finance", fetchedAt: now };

  // 1) Midas dene
  const midas = await tryMidasQuotes([symbol]);
  if (midas && midas.length === 1) {
    cacheSet(key, midas[0], 60_000);
    return { data: midas[0], source: "midas", fetchedAt: now };
  }

  // 2) Yahoo Finance
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

  // Midas toplu deneme (yalnızca tümü karşılanırsa kullanılır)
  const midas = await tryMidasQuotes(symbols);
  if (midas && midas.length === symbols.length) {
    for (const q of midas) quotes[q.symbol] = q;
    return { quotes, errors, source: "midas", fetchedAt: Date.now() };
  }

  // Yahoo — paralel (concurrency 8)
  const CONC = 8;
  const queue = [...symbols];
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
  return { quotes, errors, source: "yahoo-finance", fetchedAt: Date.now() };
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
