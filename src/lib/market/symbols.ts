/**
 * BIST Hisse Evreni — Midas platformunda işlem gören likit BIST hisseleri.
 * Semboller Yahoo Finance formatında .IS uzantısıyla kullanılır.
 * Bu liste statik referans verisidir (sembol + şirket adı + sektör) — fiyat/hacim bilgisi DEĞİLDİR.
 */

export interface StockMeta {
  symbol: string; // Midas / BIST sembolü
  yahoo: string; // Yahoo Finance sembolü
  name: string; // Şirket adı
  sector: string; // Sektör
}

export const BIST_UNIVERSE: StockMeta[] = [
  { symbol: "THYAO", yahoo: "THYAO.IS", name: "Türk Hava Yolları", sector: "Ulaştırma" },
  { symbol: "ASELS", yahoo: "ASELS.IS", name: "Aselsan", sector: "Savunma" },
  { symbol: "TUPRS", yahoo: "TUPRS.IS", name: "Tüpraş", sector: "Enerji" },
  { symbol: "EREGL", yahoo: "EREGL.IS", name: "Ereğli Demir Çelik", sector: "Metal" },
  { symbol: "KCHOL", yahoo: "KCHOL.IS", name: "Koç Holding", sector: "Holding" },
  { symbol: "SAHOL", yahoo: "SAHOL.IS", name: "Sabancı Holding", sector: "Holding" },
  { symbol: "GARAN", yahoo: "GARAN.IS", name: "Garanti BBVA", sector: "Bankacılık" },
  { symbol: "AKBNK", yahoo: "AKBNK.IS", name: "Akbank", sector: "Bankacılık" },
  { symbol: "ISCTR", yahoo: "ISCTR.IS", name: "İş Bankası (C)", sector: "Bankacılık" },
  { symbol: "YKBNK", yahoo: "YKBNK.IS", name: "Yapı Kredi", sector: "Bankacılık" },
  { symbol: "VAKBN", yahoo: "VAKBN.IS", name: "VakıfBank", sector: "Bankacılık" },
  { symbol: "HALKB", yahoo: "HALKB.IS", name: "Halkbank", sector: "Bankacılık" },
  { symbol: "ARCLK", yahoo: "ARCLK.IS", name: "Arçelik", sector: "Dayanıklı Tüketim" },
  { symbol: "BIMAS", yahoo: "BIMAS.IS", name: "BİM Birleşik Mağazalar", sector: "Perakende" },
  { symbol: "MGROS", yahoo: "MGROS.IS", name: "Migros", sector: "Perakende" },
  { symbol: "SOKM", yahoo: "SOKM.IS", name: "Şok Marketler", sector: "Perakende" },
  { symbol: "FROTO", yahoo: "FROTO.IS", name: "Ford Otosan", sector: "Otomotiv" },
  { symbol: "TOASO", yahoo: "TOASO.IS", name: "Tofaş", sector: "Otomotiv" },
  { symbol: "TCELL", yahoo: "TCELL.IS", name: "Turkcell", sector: "Telekom" },
  { symbol: "TTKOM", yahoo: "TTKOM.IS", name: "Türk Telekom", sector: "Telekom" },
  { symbol: "SISE", yahoo: "SISE.IS", name: "Şişecam", sector: "Cam" },
  { symbol: "PETKM", yahoo: "PETKM.IS", name: "Petkim", sector: "Petrokimya" },
  { symbol: "PGSUS", yahoo: "PGSUS.IS", name: "Pegasus", sector: "Ulaştırma" },
  { symbol: "DOAS", yahoo: "DOAS.IS", name: "Doğuş Otomotiv", sector: "Otomotiv" },
  { symbol: "OYAKC", yahoo: "OYAKC.IS", name: "Oyak Çimento", sector: "Çimento" },
  { symbol: "KOZAL", yahoo: "KOZAL.IS", name: "Koza Altın", sector: "Madencilik" },
  { symbol: "KOZAA", yahoo: "KOZAA.IS", name: "Koza Madencilik", sector: "Madencilik" },
  { symbol: "ENKAI", yahoo: "ENKAI.IS", name: "Enka İnşaat", sector: "İnşaat" },
  { symbol: "ALARK", yahoo: "ALARK.IS", name: "Alarko Holding", sector: "Holding" },
  { symbol: "TAVHL", yahoo: "TAVHL.IS", name: "TAV Havalimanları", sector: "Ulaştırma" },
  { symbol: "ASTOR", yahoo: "ASTOR.IS", name: "Astor Enerji", sector: "Enerji" },
  { symbol: "GUBRF", yahoo: "GUBRF.IS", name: "Gübre Fabrikaları", sector: "Kimya" },
  { symbol: "HEKTS", yahoo: "HEKTS.IS", name: "Hektaş", sector: "Kimya" },
  { symbol: "KRDMD", yahoo: "KRDMD.IS", name: "Kardemir (D)", sector: "Metal" },
  { symbol: "AEYAZ", yahoo: "AEYAZ.IS", name: "Aegon Sigorta", sector: "Sigorta" },
  { symbol: "ANSGR", yahoo: "ANSGR.IS", name: "Anadolu Sigorta", sector: "Sigorta" },
  { symbol: "AGHOL", yahoo: "AGHOL.IS", name: "AG Anadolu Grubu", sector: "Holding" },
  { symbol: "ECILC", yahoo: "ECILC.IS", name: "Eczacıbaşı Yapı", sector: "Yapı Malzemeleri" },
  { symbol: "CEMTS", yahoo: "CEMTS.IS", name: "Çimsa", sector: "Çimento" },
  { symbol: "ULKER", yahoo: "ULKER.IS", name: "Ülker Bisküvi", sector: "Gıda" },
  { symbol: "TATGD", yahoo: "TATGD.IS", name: "Tat Gıda", sector: "Gıda" },
  { symbol: "BRISA", yahoo: "BRISA.IS", name: "Brisa", sector: "Otomotiv Yan" },
  { symbol: "LOGO", yahoo: "LOGO.IS", name: "Logo Yazılım", sector: "Teknoloji" },
  { symbol: "VESTL", yahoo: "VESTL.IS", name: "Vestel", sector: "Dayanıklı Tüketim" },
  { symbol: "KCAER", yahoo: "KCAER.IS", name: "Kordsa", sector: "Kimya" },
  { symbol: "AKSA", yahoo: "AKSA.IS", name: "Aksa Akrilik", sector: "Kimya" },
  { symbol: "AKSEN", yahoo: "AKSEN.IS", name: "Aksa Enerji", sector: "Enerji" },
  { symbol: "AYDEM", yahoo: "AYDEM.IS", name: "Aydem Enerji", sector: "Enerji" },
  { symbol: "MAVI", yahoo: "MAVI.IS", name: "Mavi Giyim", sector: "Perakende" },
  { symbol: "GOODY", yahoo: "GOODY.IS", name: "Goodyear Lastik", sector: "Otomotiv Yan" },
  { symbol: "TURSG", yahoo: "TURSG.IS", name: "Türk Traktör", sector: "Otomotiv" },
  { symbol: "ASUZU", yahoo: "ASUZU.IS", name: "Anadolu Isuzu", sector: "Otomotiv" },
  { symbol: "ISDMR", yahoo: "ISDMR.IS", name: "İskenderun Demir Çelik", sector: "Metal" },
  { symbol: "KONTR", yahoo: "KONTR.IS", name: "Kontrolmatik", sector: "Teknoloji" },
  { symbol: "SMART", yahoo: "SMART.IS", name: "Smart Güneş Enerji", sector: "Enerji" },
  { symbol: "EGEEN", yahoo: "EGEEN.IS", name: "Ege Endüstri", sector: "Otomotiv Yan" },
  { symbol: "AFYON", yahoo: "AFYON.IS", name: "Afyon Çimento", sector: "Çimento" },
  { symbol: "ODAS", yahoo: "ODAS.IS", name: "ODAŞ Elektrik", sector: "Enerji" },
  { symbol: "IHEVA", yahoo: "IHEVA.IS", name: "İhlas Evva", sector: "Dayanıklı Tüketim" },
  { symbol: "SMRTG", yahoo: "SMRTG.IS", name: "Aksa Sigorta", sector: "Sigorta" },
];

export const SYMBOLS = BIST_UNIVERSE.map((s) => s.symbol);

export function findStock(symbol: string): StockMeta | undefined {
  const up = symbol.toUpperCase().replace(".IS", "");
  return BIST_UNIVERSE.find((s) => s.symbol === up);
}

export function toYahoo(symbol: string): string {
  const up = symbol.toUpperCase().replace(".IS", "");
  return `${up}.IS`;
}

// Temel piyasa göstergeleri
export const INDEX_SYMBOLS = {
  bist100: { symbol: "XU100", yahoo: "XU100.IS", name: "BIST 100" },
  bist30: { symbol: "XU030", yahoo: "XU030.IS", name: "BIST 30" },
  usdtry: { symbol: "USDTRY", yahoo: "USDTRY=X", name: "Dolar/TL" },
  eurtry: { symbol: "EURTRY", yahoo: "EURTRY=X", name: "Euro/TL" },
  gold: { symbol: "XAUUSD", yahoo: "GC=F", name: "Altın (Ons)" },
  brent: { symbol: "BRENT", yahoo: "BZ=F", name: "Brent Petrol" },
};
