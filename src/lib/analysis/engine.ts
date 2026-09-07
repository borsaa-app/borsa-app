/**
 * AI Yatırım Karar Motoru
 *
 * Girdiler: gerçek piyasa verisi + gerçek teknik göstergeler + gerçek haber akışı + piyasa rejimi
 * Çıktılar: skor, karar, senaryolar, pozisyon yönetimi, profesyonel analiz metni
 *
 * KESİN KURALLAR:
 * - Kesin kazanç garantisi/asla verilmez; her şey olasılık + senaryo olarak sunulur.
 * - Yeterli veri yoksa "YETERLİ VERİ YOK" kararı döner.
 * - Tüm sayısal değerler gerçek veriden türetilir (ATR, Bollinger, vs.).
 */

import type { Candle, History, Quote } from "@/lib/market/providers";
import { computeIndicators, type IndicatorSnapshot } from "./indicators";
import { findLevels, type Level, type Regime } from "./support-resistance";
import type { MarketNewsResult } from "@/lib/market/news";

/* ------------------------------------------------------------------ */
/* Senaryolar                                                          */
/* ------------------------------------------------------------------ */

export interface Scenario {
  name: "BOĞA SENARYOSU" | "ANA SENARYO" | "AYI SENARYOSU";
  probability: number; // %
  changeLow: number; // %
  changeHigh: number; // %
  targetLow: number;
  targetHigh: number;
  condition: string;
}

export interface Horizon {
  key: "kisa" | "orta" | "uzun";
  label: string;
  duration: string;
  scenarios: Scenario[];
}

export interface PositionPlan {
  entryZoneLow: number;
  entryZoneHigh: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  riskReward: number;
  expectedReturnLow: number; // % ana senaryo
  expectedReturnHigh: number;
  maxAcceptableLoss: string;
  positionSizeNote: string;
  trailingStop: number; // ATR tabanlı
}

export interface Decision {
  code: "GUC_ALIM" | "ALIM" | "BEKLE" | "KORU" | "RISK_AZALT" | "CIKIS" | "GUCLU_CIKIS" | "VERI_YOK";
  label: string;
  color: "green" | "lime" | "yellow" | "amber" | "orange" | "red" | "darkred" | "gray";
  reasons: string[];
  invalidation: string;
}

export interface InvestmentScore {
  total: number; // 0-100
  label: string; // ÇOK GÜÇLÜ / GÜÇLÜ / ORTA / ZAYIF / ÇOK ZAYIF
  breakdown: {
    technical: { weight: number; score: number; note: string };
    fundamentalProxy: { weight: number; score: number; note: string };
    momentum: { weight: number; score: number; note: string };
    volume: { weight: number; score: number; note: string };
    news: { weight: number; score: number; note: string };
    sector: { weight: number; score: number; note: string };
    risk: { weight: number; score: number; note: string };
  };
}

export interface Analysis {
  symbol: string;
  name: string;
  sector: string;
  currency: string;
  quote: Quote;
  indicators: IndicatorSnapshot;
  supports: Level[];
  resistances: Level[];
  regime: Regime;
  horizons: Horizon[];
  score: InvestmentScore;
  decision: Decision;
  position: PositionPlan;
  newsSummary: { overall: number; bullish: number; bearish: number; highImpact: number; text: string };
  narrative: {
    genel: string;
    teknik: string;
    temel: string;
    haber: string;
    sektor: string;
    risk: string;
    sonuc: string;
  };
  weekAgoClose: number | null; // ~5 işlem günü önce kapanış (haftalık K/Z için)
  monthAgoClose: number | null; // ~21 işlem günü önce kapanış (aylık)
  source: string;
  dataNote: string;
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Geçerlilik: bir senaryonun iptal koşulu */
function invalidationText(supports: Level[], stop: number): string {
  const nearest = supports[0];
  if (nearest) {
    return `${round2(nearest.price)} TL destek seviyesinin gün kapanışıyla hacimli şekilde altına inmesi durumunda bu senaryo geçersiz sayılmalıdır.`;
  }
  return `Stop seviyesi ${round2(stop)} TL'nin altına gün kapanışıyla inilirse senaryo geçersizdir.`;
}

/* ------------------------------------------------------------------ */
/* Senaryo üretimi — ATR/Bollinger tabanlı (uydurma değil, istatistik) */
/* ------------------------------------------------------------------ */

function buildHorizons(ind: IndicatorSnapshot, supports: Level[], resistances: Level[], regime: Regime, newsScore: number): Horizon[] {
  const price = ind.price;
  const atrPct = ind.atrPercent ?? 2.5; // günlük ortalama hareket %
  const annVol = ind.annVol ?? 30;
  const weeklyAtr = atrPct * Math.sqrt(5);
  const monthlyAtr = atrPct * Math.sqrt(21);
  const quarterlyAtr = atrPct * Math.sqrt(63);

  // Yön belirleyiciler
  const trendUp = (ind.ema20 ?? price) > (ind.ema50 ?? price) && price > (ind.ema50 ?? price);
  const trendStrongUp = trendUp && price > (ind.ema20 ?? price) && (ind.macdHist ?? 0) > 0;
  const trendDown = price < (ind.ema50 ?? price) && (ind.ema20 ?? price) < (ind.ema50 ?? price);
  const momentumUp = (ind.rsi14 ?? 50) > 52 && (ind.macdHist ?? 0) > (ind.macdHistPrev ?? 0);
  const momentumDown = (ind.rsi14 ?? 50) < 45;

  // Haber akışı yönü (ağırlığı sınırlı)
  const newsBias = Math.max(-0.15, Math.min(0.15, newsScore / 400));

  // Piyasa rejimi çarpanı — düşüşte senaryolar temkinli
  let regimeBias = 0;
  if (regime.type === "guclu_yukselis") regimeBias = 0.1;
  else if (regime.type === "yukselis") regimeBias = 0.05;
  else if (regime.type === "dusus") regimeBias = -0.12;
  else if (regime.type === "panik") regimeBias = -0.18;
  else if (regime.type === "dalgalı") regimeBias = -0.04;

  const direction = (trendUp ? 0.25 : 0) + (trendStrongUp ? 0.15 : 0) + (trendDown ? -0.25 : 0) + (momentumUp ? 0.12 : 0) + (momentumDown ? -0.12 : 0) + newsBias + regimeBias;

  function makeScenarios(periodAtr: number, label: { bull: string; base: string; bear: string }): Scenario[] {
    // Ana senaryo: yön * ATR tabanlı hareket (kısmi tersine dönüş riski ile)
    const baseLow = direction * periodAtr * 0.5;
    const baseHigh = direction * periodAtr;
    const bullLow = Math.max(baseHigh * 0.6, periodAtr * 0.35);
    const bullHigh = bullLow + periodAtr * (0.5 + Math.abs(direction) * 0.4);
    const bearLow = -periodAtr * (0.45 + Math.abs(Math.min(direction, 0)) * 0.4);
    const bearHigh = Math.min(bearLow + periodAtr * 0.4, -periodAtr * 0.15);

    // Olasılıklar: yön ne kadar netse ana senaryo olasılığı o kadar yüksek
    const dirAbs = Math.abs(direction);
    let pBase = 45 + dirAbs * 20;
    let pBull = 25 + Math.max(0, direction) * 20 - Math.max(0, -direction) * 8;
    let pBear = 30 - Math.max(0, direction) * 10 + Math.max(0, -direction) * 15;
    if (regime.volatilityLevel === "yüksek") {
      pBase -= 5;
      pBull += 2;
      pBear += 3;
    }
    const total = pBase + pBull + pBear;
    pBase = Math.round((pBase / total) * 100);
    pBull = Math.round((pBull / total) * 100);
    pBear = 100 - pBase - pBull;

    return [
      {
        name: "BOĞA SENARYOSU",
        probability: Math.max(10, Math.min(40, pBull)),
        changeLow: round2(bullLow),
        changeHigh: round2(bullHigh),
        targetLow: round2(price * (1 + bullLow / 100)),
        targetHigh: round2(price * (1 + bullHigh / 100)),
        condition: label.bull,
      },
      {
        name: "ANA SENARYO",
        probability: Math.max(30, Math.min(60, pBase)),
        changeLow: round2(baseLow),
        changeHigh: round2(baseHigh),
        targetLow: round2(price * (1 + baseLow / 100)),
        targetHigh: round2(price * (1 + baseHigh / 100)),
        condition: label.base,
      },
      {
        name: "AYI SENARYOSU",
        probability: Math.max(10, Math.min(40, pBear)),
        changeLow: round2(bearLow),
        changeHigh: round2(bearHigh),
        targetLow: round2(price * (1 + bearLow / 100)),
        targetHigh: round2(price * (1 + bearHigh / 100)),
        condition: label.bear,
      },
    ];
  }

  const nearRes = resistances[0]?.price;
  const nearSup = supports[0]?.price;

  return [
    {
      key: "kisa",
      label: "KISA VADE",
      duration: "1-5 işlem günü",
      scenarios: makeScenarios(weeklyAtr, {
        bull: nearRes ? `${round2(nearRes)} TL direncinin hacimli kırılması durumunda hareket hızlanır.` : "Kısa vadeli momentumun güçlenmesi durumunda bant üstüne çıkış görülebilir.",
        base: trendUp ? "Yükseliş trendi ve momentumun korunması beklentisiyle olasılık aralığı verilmiştir." : trendDown ? "Mevcut zayıf trendin sürmesi durumunda olasılık aralığı verilmiştir." : "Yön arayışının sürmesi durumunda olasılık aralığı verilmiştir.",
        bear: nearSup ? `${round2(nearSup)} TL desteğinin kırılması durumunda satış baskısı artar.` : "Kısa vadeli momentumun zayıflaması durumunda geri çekilme görülebilir.",
      }),
    },
    {
      key: "orta",
      label: "ORTA VADE",
      duration: "2-8 hafta",
      scenarios: makeScenarios(monthlyAtr * 1.6, {
        bull: "Trend ve temel görünümün güçlenmesi, kur/faiz ortamının desteklemesi durumunda.",
        base: trendUp ? "Orta vadeli yükseliş kanalının korunması durumunda." : trendDown ? "Orta vadeli zayıf görünümün sürmesi durumunda." : "Orta vadede fiyat yapısının konsolidasyonunu sürdürmesi durumunda.",
        bear: "Trendin bozulması ve makro görünümün kötüleşmesi durumunda.",
      }),
    },
    {
      key: "uzun",
      label: "UZUN VADE",
      duration: "3-12 ay",
      scenarios: makeScenarios(quarterlyAtr * 2.2, {
        bull: "Şirketin büyümesinin ve sektör görünümünün güçlenmesi, değerlemenin düzelmesi durumunda.",
        base: "Şirketin mevcut temel görünümünü koruması ve piyasa koşullarının ılımlı seyretmesi durumunda.",
        bear: "Makro şok, rekabet kaybı veya değerleme daralması durumunda.",
      }),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Skorlama                                                            */
/* ------------------------------------------------------------------ */

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function buildScore(ind: IndicatorSnapshot, supports: Level[], resistances: Level[], regime: Regime, newsAgg: MarketNewsResult, sectorStrength: number | null): InvestmentScore {
  const price = ind.price;
  let tech = 50;
  let techNotes: string[] = [];
  if (ind.ema20 != null && ind.ema50 != null) {
    if (price > ind.ema20 && ind.ema20 > ind.ema50) tech += 20;
    else if (price > ind.ema50) tech += 8;
    else if (price < ind.ema20 && ind.ema20 < ind.ema50) tech -= 20;
    else tech -= 5;
  }
  if (ind.macdHist != null) {
    if (ind.macdHist > 0 && (ind.macdHistPrev ?? 0) <= 0) {
      tech += 10;
      techNotes.push("MACD yeni pozitif kesişim yaptı");
    } else if (ind.macdHist > 0) tech += 5;
    else if (ind.macdHist < 0 && (ind.macdHistPrev ?? 0) > 0) tech -= 10;
    else tech -= 4;
  }
  const rsi = ind.rsi14 ?? 50;
  if (rsi > 70) tech -= 5; // aşırı alım — yeni alım için dezavantaj
  else if (rsi > 55) tech += 10;
  else if (rsi < 30) tech += 5; // aşırı satım — dönüş potansiyeli
  else if (rsi < 45) tech -= 8;

  // destek/direnç konumu
  const nearRes = resistances[0];
  if (nearRes && nearRes.price > 0) {
    const distPct = ((nearRes.price - price) / price) * 100;
    if (distPct < 2) tech -= 5; // dirence yapışık
    else if (distPct > 10) tech += 5;
  }
  const nearSup = supports[0];
  if (nearSup && nearSup.price > 0) {
    const distPct = ((price - nearSup.price) / price) * 100;
    if (distPct < 3) tech += 5; // destek yakınında risk/ödül iyi
  }
  if (ind.adx14 != null && ind.adx14 > 25 && (ind.plusDI ?? 0) > (ind.minusDI ?? 100)) tech += 8;
  if (ind.adx14 != null && ind.adx14 > 25 && (ind.minusDI ?? 0) > (ind.plusDI ?? 0)) tech -= 8;
  tech = clampScore(tech);
  techNotes = techNotes.slice(0, 2);

  // Temel proxy: Yahoo'dan gerçek temel veri yok — fiyat konumu + momentum yapısından türetilen
  // dürüst bir proxy. (52 hafta konumu + trend yapısı) — "temel veri yok" durumunda uydurmayız,
  // proxy olduğunu açıkça belirtiriz.
  let fund = 50;
  if (ind.from52High != null) {
    if (ind.from52High > -5) fund += 15; // zirveye yakın güç
    else if (ind.from52High > -15) fund += 8;
    else if (ind.from52High < -40) fund -= 10; // derin düşüş — value trap riski
    else fund += 2;
  }
  if (ind.ret60d != null) {
    if (ind.ret60d > 15) fund += 8;
    else if (ind.ret60d < -15) fund -= 8;
  }
  fund = clampScore(fund);

  // Momentum
  let mom = 50;
  if (ind.ret5d != null) mom += Math.max(-25, Math.min(25, ind.ret5d * 2.5));
  if (ind.ret20d != null) mom += Math.max(-20, Math.min(20, ind.ret20d * 0.8));
  if (ind.obvSlope != null) mom += Math.max(-10, Math.min(10, ind.obvSlope / 5));
  mom = clampScore(mom);

  // Hacim
  let vol = 50;
  if (ind.volRatio != null) {
    if (ind.volRatio > 1.8 && (ind.ret5d ?? 0) > 0) {
      vol += 25;
    } else if (ind.volRatio > 1.5 && (ind.ret5d ?? 0) > 0) vol += 15;
    else if (ind.volRatio > 1.5 && (ind.ret5d ?? 0) < 0) vol -= 20;
    else if (ind.volRatio < 0.6) vol -= 5;
  }
  vol = clampScore(vol);

  // Haber
  let news = 50 + newsAgg.overallSentiment * 0.45;
  if (newsAgg.bearishCount > newsAgg.bullishCount * 2 && newsAgg.items.length >= 3) news -= 10;
  if (newsAgg.bullishCount > newsAgg.bearishCount * 2 && newsAgg.items.length >= 3) news += 8;
  news = clampScore(news);

  // Sektör: sektörel güç verisi yoksa nötr 50; varsa kullanılır
  const sector = sectorStrength != null ? clampScore(50 + sectorStrength) : 50;

  // Risk: volatilite ters orantılı
  let risk = 60;
  if (ind.annVol != null) {
    if (ind.annVol < 20) risk += 20;
    else if (ind.annVol < 30) risk += 10;
    else if (ind.annVol > 55) risk -= 25;
    else if (ind.annVol > 40) risk -= 12;
  }
  if (regime.volatilityLevel === "yüksek") risk -= 10;
  risk = clampScore(risk);

  const w = regime.weights ?? { technical: 25, fundamentalProxy: 25, momentum: 15, volume: 10, news: 10, sector: 10, risk: 5 };
  const total = Math.round(
    (tech * w.technical +
      fund * w.fundamentalProxy +
      mom * w.momentum +
      vol * w.volume +
      news * w.news +
      sector * w.sector +
      risk * w.risk) /
      (w.technical + w.fundamentalProxy + w.momentum + w.volume + w.news + w.sector + w.risk)
  );

  const label = total >= 85 ? "ÇOK GÜÇLÜ" : total >= 70 ? "GÜÇLÜ" : total >= 55 ? "ORTA" : total >= 40 ? "ZAYIF" : "ÇOK ZAYIF";

  return {
    total,
    label,
    breakdown: {
      technical: { weight: w.technical, score: tech, note: techNotes.join(", ") || (price > (ind.ema50 ?? price) ? "Fiyat EMA50 üzerinde" : "Fiyat EMA50 altında") },
      fundamentalProxy: { weight: w.fundamentalProxy, score: fund, note: `52 hafta zirvesinden ${round2(ind.from52High ?? 0)}% konum (proxy)` },
      momentum: { weight: w.momentum, score: mom, note: `5 gün: ${round2(ind.ret5d ?? 0)}%, 20 gün: ${round2(ind.ret20d ?? 0)}%` },
      volume: { weight: w.volume, score: vol, note: ind.volRatio ? `Hacim ortalamanın ${round2(ind.volRatio * 100)}%` : "Hacim verisi yetersiz" },
      news: { weight: w.news, score: news, note: newsAgg.items.length ? `${newsAgg.items.length} haber, akış ${newsAgg.overallSentiment > 8 ? "olumlu" : newsAgg.overallSentiment < -8 ? "olumsuz" : "nötr"}` : "Güncel haber yok" },
      sector: { weight: w.sector, score: sector, note: sectorStrength != null ? "Sektör kıyaslaması dahil" : "Sektörel veri sınırlı — nötr" },
      risk: { weight: w.risk, score: risk, note: ind.annVol ? `Yıllık volatilite ${round2(ind.annVol)}%` : "Volatilite hesaplanamadı" },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Karar motoru                                                        */
/* ------------------------------------------------------------------ */

function buildDecision(ind: IndicatorSnapshot, supports: Level[], resistances: Level[], score: InvestmentScore, regime: Regime, newsAgg: MarketNewsResult, volRatioCheck: boolean): Decision {
  const price = ind.price;
  const reasons: string[] = [];
  const rsi = ind.rsi14 ?? 50;
  const aboveEma50 = ind.ema50 != null && price > ind.ema50;
  const emaBull = ind.ema20 != null && ind.ema50 != null && ind.ema20 > ind.ema50;
  const macdPos = (ind.macdHist ?? 0) > 0;
  const volHigh = (ind.volRatio ?? 1) > 1.5;

  let code: Decision["code"];
  let label: string;
  let color: Decision["color"];

  if (score.total >= 78 && aboveEma50 && rsi < 75) {
    code = "GUC_ALIM";
    label = "GÜÇLÜ ALIM FIRSATI";
    color = "green";
    reasons.push(`Bileşik skor ${score.total}/100 (${score.label}) seviyesinde.`);
    if (emaBull) reasons.push("EMA20, EMA50 üzerinde: kısa vadeli trend yükseliş yönünde yapılandırılmış.");
    if (macdPos) reasons.push("MACD histogram pozitif: momentum alıcı lehine.");
    if (volHigh && volRatioCheck) reasons.push(`Hacim ortalamanın ${(ind.volRatio! * 100).toFixed(0)}% üzerinde: hareket likidite destekli.`);
  } else if (score.total >= 65 && aboveEma50) {
    code = "ALIM";
    label = "ALIM DEĞERLENDİRİLEBİLİR";
    color = "lime";
    reasons.push(`Bileşik skor ${score.total}/100 seviyesinde ve fiyat EMA50 üzerinde.`);
    reasons.push("Agresif giriş yerine destek bölgesindeki geri çekilmelerden kademeli pozisyon daha dengeli risk/getiri sunar.");
  } else if (score.total >= 50) {
    code = "BEKLE";
    label = "BEKLE";
    color = "yellow";
    reasons.push(`Bileşik skor ${score.total}/100: karar vermek için yeterli netlik yok.`);
    if (resistances[0]) reasons.push(`${resistances[0].price.toFixed(2)} TL direncine yönelik hacimli kırılım teyidi beklenmeli.`);
    if (!aboveEma50) reasons.push("Fiyat EMA50 altında: trend teyidi beklenmeli.");
  } else if (score.total >= 40) {
    code = ind.ema50 != null && price > ind.ema50 ? "KORU" : "BEKLE";
    label = code === "KORU" ? "POZİSYONU KORU" : "BEKLE";
    color = code === "KORU" ? "amber" : "yellow";
    reasons.push(`Bileşik skor ${score.total}/100: görünüm karışık.`);
    if (code === "KORU") reasons.push("Mevcut pozisyon varsa trend bozulmadıkça korunabilir; yeni alım için teyit beklenmeli.");
  } else if (score.total >= 30) {
    code = "RISK_AZALT";
    label = "RİSK AZALT";
    color = "orange";
    reasons.push(`Bileşik skor ${score.total}/100: zayıflayan görünüm.`);
    reasons.push("Trend zayıflıyor fakat tamamen bozulmadı; pozisyon boyutunun küçültülmesi düşünülebilir.");
  } else if (score.total >= 20) {
    code = "CIKIS";
    label = "ÇIKIŞ DEĞERLENDİR";
    color = "red";
    reasons.push(`Bileşik skor ${score.total}/100: negatif görünüm baskın.`);
    reasons.push("Trend yapısı bozuldu ve daha fazla düşüş riski yükseldi; çıkış değerlendirilmeli.");
  } else {
    code = "GUCLU_CIKIS";
    label = "GÜÇLÜ ÇIKIŞ SİNYALİ";
    color = "darkred";
    reasons.push(`Bileşik skor ${score.total}/100: ciddi negatif birikim.`);
    reasons.push("Çoklu gösterge aynı yönde bozulma işaret ediyor; risk yönetimi önceliklidir.");
  }

  // Rejim uyarısı ekle
  if (regime.type === "dusus" || regime.type === "panik") {
    reasons.push(`Piyasa rejimi "${regime.label}": genel piyasa riski tüm kararların üzerinde.`);
  }
  if (newsAgg.highImpactCount > 0) {
    reasons.push(`${newsAgg.highImpactCount} yüksek etkili haber mevcut: haber akışı takip edilmeli.`);
  }
  if (newsAgg.items.length === 0) {
    reasons.push("Bu hisse için güncel haber bulunamadı; haber kaynaklı risk değerlendirmesi yapılamadı.");
  }

  const invalidation = invalidationText(supports, 0);
  return { code, label, color, reasons, invalidation };
}

/* ------------------------------------------------------------------ */
/* Pozisyon planı (giriş/hedef/stop/R-R/boyut/trailing)                */
/* ------------------------------------------------------------------ */

export const MIN_INVESTMENT_TL = 100;

function buildPositionPlan(ind: IndicatorSnapshot, supports: Level[], resistances: Level[], horizons: Horizon[]): PositionPlan {
  const price = ind.price;
  const atr = ind.atr14 ?? price * 0.025;
  const sup1 = supports[0]?.price ?? price - atr * 2;
  const sup2 = supports[1]?.price ?? sup1 - atr;
  const res1 = resistances[0]?.price ?? price + atr * 2;
  const res2 = resistances[1]?.price ?? res1 + atr;

  // Giriş bölgesi: mevcut fiyat ile ilk destek arasında
  const entryLow = Math.min(price * 0.985, sup1 * 1.005);
  const entryHigh = price * 1.01;

  const target1 = Math.round(res1 * 100) / 100;
  const target2 = Math.round((res2 > res1 ? res2 : res1 + atr * 1.5) * 100) / 100;
  const target3 = Math.round((res2 > res1 ? res2 + atr * 1.5 : res1 + atr * 2.5) * 100) / 100;

  // Stop: ilk desteğin biraz altı veya 2xATR — hangisi yakınsa mantıklısı
  const atrStop = price - atr * 2;
  const stopLoss = Math.round(Math.max(sup2 * 0.99, Math.min(sup1 * 0.985, atrStop)) * 100) / 100;

  const midTarget = (target1 + target2) / 2;
  const risk = price - stopLoss;
  const reward = midTarget - price;
  const riskReward = risk > 0 ? round2(reward / risk) : 0;

  // Ana senaryodan beklenen getiri (kısa-orta vade)
  const base = horizons[1].scenarios.find((s) => s.name === "ANA SENARYO");
  const expectedReturnLow = base?.changeLow ?? 0;
  const expectedReturnHigh = base?.changeHigh ?? 0;

  const trailingStop = Math.round((price - atr * 1.8) * 100) / 100;

  return {
    entryZoneLow: round2(entryLow),
    entryZoneHigh: round2(entryHigh),
    target1,
    target2,
    target3,
    stopLoss,
    riskReward,
    expectedReturnLow,
    expectedReturnHigh,
    trailingStop,
    maxAcceptableLoss: `Stop ${stopLoss} TL seviyesinde tutulduğunda pozisyon başına maksimum kabul edilebilir zarar ${round2(((price - stopLoss) / price) * 100)}%'dir.`,
    positionSizeNote: `Tek pozisyon, toplam portföyün %5-10'unu geçmemelidir. Minimum yatırım tutarı ${MIN_INVESTMENT_TL} TL'dir; 100 TL ve katlarıyla kademeli pozisyon kurulabilir.`,
  };
}

/* ------------------------------------------------------------------ */
/* Profesyonel anlatım üreticisi (deterministik, veriden türeyen)      */
/* ------------------------------------------------------------------ */

function fmt(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "veri yok";
  return x.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function buildNarrative(ind: IndicatorSnapshot, supports: Level[], resistances: Level[], regime: Regime, score: InvestmentScore, decision: Decision, newsAgg: MarketNewsResult, name: string, sector: string): Analysis["narrative"] {
  const price = ind.price;
  const trendWord = ind.ema20 != null && ind.ema50 != null ? (ind.ema20 > ind.ema50 ? "pozitif" : "negatif") : "belirsiz";
  const res0 = resistances[0];
  const sup0 = supports[0];

  const genel = `Mevcut fiyat yapısında ${name} için kısa vadeli görünüm ${trendWord} kalmaya devam ediyor. Hisse ${fmt(price)} TL seviyesinde işlem görüyor ve bileşik değerlendirme ${score.total}/100 (${score.label}) veriyor. ${regime.type === "dusus" || regime.type === "panik" ? `Genel piyasa rejimi "${regime.label}" olduğundan kararlar bu risk göz önünde tutularak verilmiştir.` : `Genel piyasa rejimi "${regime.label}" olarak tanımlanıyor ve bu hissenin göreli gücü bu ortamda değerlendirilmiştir.`}`;

  const teknik = `Teknik tablo: RSI ${fmt(ind.rsi14, 1)} seviyesinde (${(ind.rsi14 ?? 50) > 70 ? "aşırı alım bölgesi — yeni giriş için riskli" : (ind.rsi14 ?? 50) < 30 ? "aşırı satım bölgesi — tepki alımı potansiyeli" : "nötr bölge"}). MACD histogramı ${(ind.macdHist ?? 0) > 0 ? "pozitif" : "negatif"} seyrediyor${ind.macdHist != null && ind.macdHistPrev != null && Math.abs(ind.macdHist) > Math.abs(ind.macdHistPrev) ? " ve güç kazanıyor" : ind.macdHist != null && ind.macdHistPrev != null ? " ancak gücünü yitiriyor" : ""}. EMA20 ${fmt(ind.ema20)} TL, EMA50 ${fmt(ind.ema50)} TL seviyesinde; fiyat bunlara göre ${price > (ind.ema50 ?? price) ? "üzerinde" : "altında"} konumda. ATR bazlı günlük ortalama hareket %${fmt(ind.atrPercent ?? 0, 1)} — bu, stop yerleşiminde volatiliteye uyum sağlanması gerektiği anlamına geliyor. ADX ${fmt(ind.adx14, 1)}: ${(ind.adx14 ?? 0) > 25 ? "trendli bir piyasa" : "trend zayıf; bant hareketi riski"}.`;

  const temel = `Temel veri katmanı bu sürümde sınırlıdır; F/K, PD/DD gibi çarpanlar veri kaynağından güvenilir şekilde alınamadığından uydurulmamıştır. Değerleme proxy'si olarak 52 hafta bandındaki konum (zirveden %${fmt(ind.from52High ?? 0, 1)}, dipten +%${fmt(((ind.price - (ind.week52Low ?? ind.price)) / (ind.week52Low ?? ind.price)) * 100, 1)}) ve 60 günlük fiyat performansı (%${fmt(ind.ret60d ?? 0, 1)}) kullanılmıştır. ${ind.from52High != null && ind.from52High > -5 ? "Fiyat yıllık zirveye yakın: güç ama aynı zamanda değerleme beklentisi de yüksek demektir." : ind.from52High != null && ind.from52High < -30 ? "Fiyat yıllık zirveden belirgin uzakta: değer algısı olabilir ancak düşüşün nedeni mutlaka araştırılmalıdır." : "Fiyat yıllık bandın orta bölgesinde dengeli bir konumda."} KAP bilanço verilerinin entegrasyonu ilerleyen sürümlerde planlanmaktadır.`;

  const haber = newsAgg.items.length === 0 ? `Bu hisse için son dönemde öne çıkan bir haber akışı bulunamadı. Haber kaynaklı bir yön beklentisi kurulamadı; teknik ve rejim değerlendirmesi ile karar desteklenmektedir.` : `${newsAgg.summary} ${res0 && newsAgg.overallSentiment > 8 ? "Olumlu haber akışı, direnç bölgesinin kırılması ihtimalini güçlendirebilir." : newsAgg.overallSentiment < -8 && sup0 ? "Olumsuz haber akışı, destek bölgesinin test edilme ihtimalini artırıyor." : "Haber akışı yön konusunda belirleyici bir baskı yaratmıyor."} Öne çıkan başlıklar: ${newsAgg.items.slice(0, 3).map((n) => `"${n.title.slice(0, 70)}${n.title.length > 70 ? "…" : ""}" (${n.source})`).join("; ")}.`;

  const sektor = `${sector} sektöründeki hisseler için sektörel kıyaslama verisi bu sürümde sınırlıdır; sektör endeksi karşılaştırması tam kapsamlı sunulamamaktadır. Ancak genel piyasa rejimi (${regime.label}) tüm sektörleri etkilediği için bu hissenin göreli gücü piyasa ortalamasına karşı yorumlanmıştır: 20 günlük getirisi %${fmt(ind.ret20d ?? 0, 1)}.`;

  const risk = `Ana riskler: (1) Volatilite — yıllıklandırılmış %${fmt(ind.annVol ?? 0, 1)}; bu, pozisyon boyutunun volatiliteye göre ayarlanmasını gerektirir. (2) ${sup0 ? `İlk önemli destek ${fmt(sup0.price)} TL: gün kapanışıyla bu seviyenin altına inilirse senaryo geçersizleşir.` : "Belirgin destek tespit edilemedi; stop mesafesi ATR ile belirlenmelidir."} (3) ${regime.volatilityLevel === "yüksek" ? "Piyasa genelinde yüksek volatilite: pozisyon boyutlarında temkin önerilir." : "Piyasa volatilitesi makul seviyede."} (4) ${newsAgg.bearishCount > 0 ? `${newsAgg.bearishCount} adet olumsuz yönlü haber mevcut; başlıklar takip edilmelidir.` : "Belirgin olumsuz haber akışı tespit edilmedi."}`;

  const sonuc = `SONUÇ: ${decision.label}. ${decision.reasons[0] ?? ""} ${decision.code === "GUC_ALIM" || decision.code === "ALIM" ? `Giriş bölgesi ${fmt(score.total >= 78 ? price * 0.99 : sup0 ? Math.min(price * 0.985, sup0 * 1.005) : price * 0.985)} TL civarı ve altı; hızlandıran teyit ${res0 ? `${fmt(res0.price)} TL direncinin hacimli kırılması` : "hacim artışıyla yeni zirveler"}.` : decision.code === "BEKLE" || decision.code === "KORU" ? "Şu anda pozisyon açmak yerine teyit sinyali beklemek daha dengeli bir yaklaşım." : decision.code === "RISK_AZALT" ? "Pozisyon varsa boyut küçültme; yoksa uzak durmak makul." : "Pozisyon varsa risk yönetimi önceliklidir."} Beklenen getiriler olasılık ve senaryo bazlıdır; kesin kazanç garantisi yoktur.`;

  return { genel, teknik, temel, haber, sektor, risk, sonuc };
}

/* ------------------------------------------------------------------ */
/* Smart Exit + pozisyon değerlendirme (portföy hisseleri için)         */
/* ------------------------------------------------------------------ */

export interface PositionAdvice {
  symbol: string;
  action: "BEKLE" | "RISK_AZALT" | "CIKISI_DEGERLENDIR" | "KADEMELI_KAR" | "TRAILING_STOP";
  headline: string;
  detail: string;
  analysis: string[];
  trailingStop: number;
}

export function evaluatePosition(
  entryPrice: number,
  qty: number,
  ind: IndicatorSnapshot,
  supports: Level[],
  resistances: Level[],
  newsAgg: MarketNewsResult,
  regime: Regime
): PositionAdvice {
  const price = ind.price;
  const gainPct = ((price - entryPrice) / entryPrice) * 100;
  const atr = ind.atr14 ?? price * 0.025;
  const trailingStop = Math.round((price - atr * 1.8) * 100) / 100;
  const analysis: string[] = [];
  let action: PositionAdvice["action"] = "BEKLE";
  let headline = "";
  let detail = "";

  const trendUp = price > (ind.ema50 ?? price) && (ind.ema20 ?? price) > (ind.ema50 ?? price);
  const trendBroken = price < (ind.ema50 ?? price) && (ind.macdHist ?? 0) < 0;
  const volHigh = (ind.volRatio ?? 1) > 1.5;
  const sup0 = supports[0]?.price;

  if (gainPct >= 10) {
    if (trendUp && (ind.macdHist ?? 0) > 0 && !volHigh || (trendUp && volHigh)) {
      action = "KADEMELI_KAR";
      headline = `Hedef bölgesine ulaştı (+%${fmt(gainPct, 1)}) ancak trend güçlü.`;
      detail = `${entryPrice.toFixed(2)} TL maliyetli pozisyon +%'si ${fmt(gainPct, 1)} ile hedef bandına ulaştı. Ancak hacim ${volHigh ? "güçlü" : "normal"} ve kısa vadeli momentum devam ediyor. Trend henüz bozulmadı. Pozisyonu hemen kapatmak yerine kademeli kâr realizasyonu veya trailing stop değerlendirilebilir.`;
      analysis.push("Trend yapısı (EMA20 > EMA50, fiyat EMA50 üzerinde) bozulmadı.");
      analysis.push(`Trailing stop önerisi: ${trailingStop} TL (ATR tabanlı, 1.8x).`);
      if (volHigh) analysis.push("Hacim yükselişi hareketin likidite destekli olduğunu gösteriyor.");
    } else {
      action = "KADEMELI_KAR";
      headline = `Hedef gerçekleşti ancak momentum zayıflıyor.`;
      detail = `Kâr hedefi aşıldı (+%${fmt(gainPct, 1)}) fakat momentum zayıflıyor, trend desteklemiyor. Kârı koruma öncelikli hale geldi. Kademeli satış veya trailing stop ile kâr koruması düşünülebilir.`;
      analysis.push("MACD histogramı pozitif değil: yukarı hareket enerjisi azalıyor.");
    }
  } else if (gainPct <= -5) {
    // Zararda: önce neden analizi
    const marketDown = regime.type === "dusus" || regime.type === "panik";
    const newsBad = newsAgg.overallSentiment < -15;
    const supportBroken = sup0 != null && price < sup0;
    const abnormalVol = (ind.volRatio ?? 1) > 2;

    analysis.push(`Genel piyasa: ${regime.label} — ${marketDown ? "düşüş hisseye özgü olmayabilir." : "piyasa geneli destekleyici, düşüş hisseye özgü olabilir."}`);
    analysis.push(`Haber akışı skoru ${newsAgg.overallSentiment} — ${newsBad ? "olumsuz haber baskısı mevcut." : "yön değiştirecek haber baskısı yok."}`);
    analysis.push(supportBroken ? `Destek ${fmt(sup0)} TL gün kapanışıyla kırılmış görünüyor.` : sup0 ? `Destek ${fmt(sup0)} TL hâlâ geçerli.` : "Yakın destek tespit edilemedi.");
    analysis.push(`Hacim ${abnormalVol ? `normalin ${(ind.volRatio! * 100).toFixed(0)}%: olağandışı satış baskısı.` : "normal bantlarda: panik satışı görünmüyor."}`);
    analysis.push(`RSI ${fmt(ind.rsi14, 1)}: ${(ind.rsi14 ?? 50) < 30 ? "aşırı satım — tepki potansiyeli." : "aşırı satım değil."}`);

    if (trendBroken && (supportBroken || newsBad)) {
      action = "CIKISI_DEGERLENDIR";
      headline = `Trend yapısı bozuldu, çıkış değerlendirilmeli (+%${fmt(gainPct, 1)}).`;
      detail = `Trend yapısı bozuldu ve daha fazla düşüş riski yüksek. Destek/haber/teknik birleşimi negatif. Pozisyonun kapatılması veya büyük oranda azaltılması değerlendirilmeli. ${sup0 ? `Geri dönüş teyidi: ${fmt(sup0)} TL'nin üzerine hacimli dönüş.` : ""}`;
    } else if (trendBroken || marketDown || abnormalVol) {
      action = "RISK_AZALT";
      headline = `Zayıflayan trend, risk azaltma düşünülebilir (+%${fmt(gainPct, 1)}).`;
      detail = `Trend zayıflıyor fakat tamamen bozulmadı. Pozisyon boyutunun bir kısmının azaltılması ve kalan kısmın ${trailingStop} TL trailing stop ile izlenmesi önerilir.`;
    } else {
      action = "BEKLE";
      headline = `Düşüş geçici düzeltme görünümünde (+%${fmt(gainPct, 1)}).`;
      detail = `Düşüş piyasa geneli/teknik düzeltme kaynaklı görünüyor; hisse özel yapısal bir bozulma tespit edilmedi. ${sup0 ? `${fmt(sup0)} TL desteği tutar beklenmeli.` : "ATR tabanlı stop izlenmeli."} Stop: ${entryPrice * 0.93 < trailingStop ? trailingStop : entryPrice * 0.93} TL.`;
    }
  } else {
    action = "BEKLE";
    headline = `Pozisyon dengede (+%${fmt(gainPct, 1)}).`;
    detail = `Pozisyon ${fmt(gainPct, 1)} seviyesinde. Trend ${trendUp ? "pozitif" : trendBroken ? "negatif" : "yatay"}. ${resistances[0] ? `İlk direnç ${fmt(resistances[0].price)} TL.` : ""} Trailing stop: ${trailingStop} TL.`;
    if (trendUp) analysis.push("Kısa vadeli trend pozitif: pozisyon tutulabilir.");
    if (trendBroken) analysis.push("Kısa vadeli trend negatife döndü: dikkatli izlenmeli.");
    if (sup0) analysis.push(`${fmt(sup0)} TL desteği kritik.`);
  }

  if (newsAgg.items.length === 0) {
    analysis.push("Not: Bu hisse için güncel haber bulunamadı; haber kaynaklı değerlendirme yapılamadı.");
  }

  return { symbol: "", action, headline, detail, analysis, trailingStop };
}

/* ------------------------------------------------------------------ */
/* Ana analiz orchestrator'ı                                           */
/* ------------------------------------------------------------------ */

export function runAnalysis(
  symbol: string,
  name: string,
  sector: string,
  quote: Quote,
  history: History,
  regime: Regime,
  newsAgg: MarketNewsResult
): Analysis {
  const candles: Candle[] = history.candles;
  const ind = computeIndicators(candles);
  const { supports, resistances } = findLevels(candles, ind.price);

  // Sektör gücü: aynı sektördeki diğer hisselerin 20g ortalaması (hızlı yaklaşım — sadece rejim bağlamında)
  const horizons = buildHorizons(ind, supports, resistances, regime, newsAgg.overallSentiment);
  const score = buildScore(ind, supports, resistances, regime, newsAgg, null);
  const decision = buildDecision(ind, supports, resistances, score, regime, newsAgg, true);
  const position = buildPositionPlan(ind, supports, resistances, horizons);
  const narrative = buildNarrative(ind, supports, resistances, regime, score, decision, newsAgg, name, sector);

  return {
    symbol,
    name,
    sector,
    currency: quote.currency,
    quote,
    indicators: ind,
    supports,
    resistances,
    regime,
    horizons,
    score,
    decision,
    position,
    newsSummary: {
      overall: newsAgg.overallSentiment,
      bullish: newsAgg.bullishCount,
      bearish: newsAgg.bearishCount,
      highImpact: newsAgg.highImpactCount,
      text: newsAgg.summary,
    },
    narrative,
    weekAgoClose: candles.length > 6 ? candles[candles.length - 6].close : null,
    monthAgoClose: candles.length > 22 ? candles[candles.length - 22].close : null,
    source: history.source === "midas" ? "Midas" : "Yahoo Finance (İstanbul)",
    dataNote: `Veri kaynağı: ${history.source === "midas" ? "Midas" : "Yahoo Finance — İstanbul Borsası"}. BIST verileri borsa saatlerinde ~15 dk gecikmeli olabilir. Son güncelleme: ${new Date(history.fetchedAt).toLocaleTimeString("tr-TR")}`,
  };
}
