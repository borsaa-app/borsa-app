/**
 * Haber Analizi — Google News RSS (gerçek haberler, uydurma yok)
 * Her haber için: kaynak, tarih, başlık, hisse ilgisi, duygu skoru.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  symbol?: string;
  sentiment: number; // -100..100
  impact: "YÜKSEK" | "ORTA" | "DÜŞÜK";
  sentimentLabel: "OLUMLU" | "OLUMSUZ" | "NÖTR";
  matchedKeywords: string[];
}

interface RssItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

function parseRss(xml: string, maxItems = 15): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1];
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const sourceTag = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    if (title) {
      items.push({
        title,
        link,
        source: decodeXml(sourceTag ?? "") || "Google Haberler",
        pubDate,
      });
    }
  }
  return items;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/* Türkçe finansal duygu sözlüğü — ağırlıklı anahtar kelimeler */
const POSITIVE: Array<[string, number]> = [
  ["kar", 15], ["kâr", 15], ["yüksek kar", 25], ["kar artışı", 25], ["rekor", 22],
  ["zamlı", 5], ["büyüme", 12], ["sözleşme", 12], ["ihale", 12], ["ihracat", 8],
  ["temettü", 18], ["geri alım", 16], ["sermaye artırımı", 8], ["ortaklık", 6],
  ["ihraç", 3], ["teşvik", 10], ["faiz indirimi", 18], ["rekor kâr", 30],
  ["bebekteni", 0], ["hedef fiyat yükseltti", 22], ["al önerisi", 15], ["yükseltti", 10],
  ["artırdı", 8], ["kapasite artışı", 15], ["yeni yatırımdır", 10], ["anlaşma", 10],
  ["kazandı", 14], ["seçildi", 4], ["bilanço beklentisi", 6], ["pozitif", 8],
  ["yatırım kararı", 12], ["bedelsiz", 14], ["ücretli", 0], ["prim", 5],
  ["rekor sipariş", 25], ["açıklama", 0], ["hacim artışı", 6], ["ihracat rekoru", 22],
];

const NEGATIVE: Array<[string, number]> = [
  ["zarar", -22], ["zarar açıkladı", -28], ["düşüş", -8], ["geriledi", -10],
  ["ceza", -18], ["idari para cezası", -20], ["soruşturma", -18], ["denetim", -6],
  ["faiz artırımı", -12], ["daralma", -14], ["recesyon", -18], ["borç", -6],
  ["satış baskısı", -12], ["geri çekilme", -5], ["risk", -4], ["kayıp", -14],
  ["iptal", -16], ["ertelemek", -8], ["ertelendi", -10], ["ihracat yasağı", -20],
  ["grev", -14], ["yangın", -20], ["kaza", -15], ["iflas", -40], ["cordu", 0],
  ["sat önerisi", -15], ["düşürdü", -10], ["indirdi", -10], ["negatif", -8],
  ["kapatma", -12], ["durduruldu", -12], ["geçici olarak", -4], ["başvuru", -2],
  ["mevzuat", -3], ["regülasyon", -5], ["vergi", -8], ["amortisman", -4],
  [" dolar yükseldi ", -6], ["kur şoku", -10], ["enflasyon", -5],
];

const HIGH_IMPACT: string[] = ["bilanço", "finansal rapor", "sermaye artırımı", "bedelsiz", "temettü", "birleşme", "devralma", "ihale", "sözleşme", "iflas", "rekor kâr", "zarar açıkladı", "geri alım", "halka arz", "ortak satışı"];

export function classifySentiment(title: string): { score: number; label: NewsItem["sentimentLabel"]; impact: NewsItem["impact"]; matched: string[] } {
  const t = " " + title.toLowerCase() + " ";
  let score = 0;
  const matched: string[] = [];

  for (const [kw, w] of POSITIVE) {
    if (kw.length > 2 && t.includes(kw.toLowerCase())) {
      score += w;
      matched.push(kw);
    }
  }
  for (const [kw, w] of NEGATIVE) {
    if (kw.length > 2 && t.includes(kw.toLowerCase())) {
      score += w;
      matched.push(kw);
    }
  }

  const impactHits = HIGH_IMPACT.filter((kw) => t.includes(kw.toLowerCase()));
  const impact: NewsItem["impact"] = impactHits.length > 0 || Math.abs(score) >= 22 ? "YÜKSEK" : Math.abs(score) >= 10 ? "ORTA" : "DÜŞÜK";

  score = Math.max(-100, Math.min(100, score));
  const label: NewsItem["sentimentLabel"] = score > 8 ? "OLUMLU" : score < -8 ? "OLUMSUZ" : "NÖTR";
  return { score, label, impact, matched: [...new Set(matched)].slice(0, 4) };
}

async function fetchGoogleNews(query: string, maxItems: number): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, maxItems);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function getStockNews(symbol: string, companyName: string, maxItems = 12): Promise<NewsItem[]> {
  const items = await fetchGoogleNews(`${symbol} OR "${companyName}" hisse`, maxItems);
  return items.map((it) => {
    const { score, label, impact, matched } = classifySentiment(it.title);
    return {
      title: it.title,
      link: it.link,
      source: it.source,
      publishedAt: it.pubDate ? new Date(it.pubDate).getTime() : Date.now(),
      symbol,
      sentiment: score,
      impact,
      sentimentLabel: label,
      matchedKeywords: matched,
    };
  });
}

export interface MarketNewsResult {
  items: NewsItem[];
  overallSentiment: number; // -100..100 ağırlıklı ortalama
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  highImpactCount: number;
  summary: string;
}

export function aggregateNews(items: NewsItem[]): MarketNewsResult {
  if (items.length === 0) {
    return {
      items: [],
      overallSentiment: 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      highImpactCount: 0,
      summary: "Bu hisse için güncel haber bulunamadı. Haber bulunamadığı için haber kaynaklı bir değerlendirme yapılmadı.",
    };
  }
  // Yakın haberler daha ağırlıklı (yarı ömür 3 gün)
  let weighted = 0;
  let totalW = 0;
  const now = Date.now();
  for (const it of items) {
    const ageDays = Math.max(0, (now - it.publishedAt) / 86400000);
    const w = Math.pow(0.5, ageDays / 3);
    weighted += it.sentiment * w;
    totalW += w;
  }
  const overall = totalW > 0 ? Math.round(weighted / totalW) : 0;
  const bullishCount = items.filter((i) => i.sentimentLabel === "OLUMLU").length;
  const bearishCount = items.filter((i) => i.sentimentLabel === "OLUMSUZ").length;
  const neutralCount = items.filter((i) => i.sentimentLabel === "NÖTR").length;
  const highImpactCount = items.filter((i) => i.impact === "YÜKSEK").length;

  const dir = overall > 8 ? "olumlu" : overall < -8 ? "olumsuz" : "nötr";
  const summary = `Son ${items.length} haber incelendi: ${bullishCount} olumlu, ${bearishCount} olumsuz, ${neutralCount} nötr. ${highImpactCount} haber yüksek etkili kategoride. Ağırlıklı haber akışı ${dir} yönde (skor: ${overall > 0 ? "+" : ""}${overall}).`;

  return { items, overallSentiment: overall, bullishCount, bearishCount, neutralCount, highImpactCount, summary };
}
