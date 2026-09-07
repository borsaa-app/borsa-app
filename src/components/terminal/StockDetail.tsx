"use client";

/**
 * Hisse Detay — Profesyonel Analist Raporu
 * GENEL / TEKNİK / TEMEL / HABER / RİSK / SENARYOLAR / HEDEF / GİRİŞ-ÇIKIŞ
 */

import { useAnalysis, useHistory, useNews } from "@/lib/api-client";
import { usePortfolio } from "@/lib/store/portfolio";
import { useState } from "react";
import { fmtNum, fmtPct, fmtPctNL, fmtTL, fmtVol, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PriceChart from "./PriceChart";
import { ArrowLeft, BarChart3, Brain, Flame, LineChart, Newspaper, Plus, Shield, Target, TrendingUp, Wallet, XCircle } from "lucide-react";

const DECISION_COLORS: Record<string, string> = {
  GUC_ALIM: "bg-emerald-500 text-emerald-950",
  ALIM: "bg-lime-500 text-lime-950",
  BEKLE: "bg-yellow-500 text-yellow-950",
  KORU: "bg-amber-500 text-amber-950",
  RISK_AZALT: "bg-orange-600 text-orange-50",
  CIKIS: "bg-red-600 text-red-50",
  GUCLU_CIKIS: "bg-red-800 text-red-50",
  VERI_YOK: "bg-zinc-600 text-zinc-100",
};

export default function StockDetail({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  const analysis = useAnalysis(symbol);
  const hist = useHistory(symbol, "6mo");
  const news = useNews(symbol, 12);
  const [range, setRange] = useState<"1mo" | "3mo" | "6mo" | "1y">("6mo");
  const histRange = useHistory(symbol, range);
  const { toast } = useToast();
  const { positions, addPosition } = usePortfolio();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");

  const a = analysis.data?.analysis;
  const chartCandles = histRange.data?.candles ?? hist.data?.candles ?? [];
  const last = a?.quote.price;
  const dayPct = a?.quote.changePercent ?? 0;

  const handleAdd = () => {
    const q = Number(qty);
    const c = Number(cost || last || 0);
    if (!q || !c) {
      toast({ title: "Hata", description: "Adet ve maliyet giriniz.", variant: "destructive" });
      return;
    }
    const res = addPosition({ symbol, name: a?.name ?? symbol, quantity: q, avgCost: c });
    if (res.ok) {
      toast({ title: "Pozisyon eklendi", description: `${symbol}: ${q} adet @ ${c} TL. Artık canlı izleniyor ve uyarılar aktif.` });
      setQty("");
      setCost("");
    } else {
      toast({ title: "Eklenemedi", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Üst başlık */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 text-[11px] px-2">
          <ArrowLeft className="h-3 w-3" /> Geri
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <h1 className="text-base font-bold">{symbol}</h1>
            <span className="text-[11px] text-muted-foreground">{a?.name ?? "—"}</span>
            <Badge variant="outline" className="text-[9px]">{a?.sector ?? "—"}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 text-xs">
            <span className="text-lg font-bold tabular-nums">{last != null ? fmtTL(last) : "—"}</span>
            <span className={cn("font-semibold tabular-nums", dayPct >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPct(dayPct)}</span>
          </div>
        </div>
      </div>

      {analysis.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {analysis.isError && (
        <Card className="border-red-500/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-500">
            <XCircle className="h-4 w-4" /> {analysis.error instanceof Error ? analysis.error.message : "Analiz alınamadı."}
          </CardContent>
        </Card>
      )}

      {a && (
        <div className="space-y-3">
          {/* Skor + Karar şeridi */}
          <Card className={cn("border-l-4", a.decision.code === "GUC_ALIM" || a.decision.code === "ALIM" ? "border-l-emerald-500" : a.decision.code === "BEKLE" || a.decision.code === "KORU" ? "border-l-yellow-500" : a.decision.code === "RISK_AZALT" ? "border-l-orange-500" : "border-l-red-600")}>
            <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2.5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg width="56" height="56" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="7" />
                    <circle
                      cx="36" cy="36" r="30" fill="none"
                      stroke={a.score.total >= 70 ? "#22c55e" : a.score.total >= 55 ? "#eab308" : "#ef4444"}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${(a.score.total / 100) * 188.5} 188.5`}
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold leading-none">{a.score.total}</span>
                    <span className="text-[8px] text-muted-foreground">/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground">SCORE</div>
                  <div className="text-[11px] font-bold">{a.score.label}</div>
                </div>
              </div>

              <div className={cn("rounded-md px-2 py-1 text-[11px] font-bold", DECISION_COLORS[a.decision.code])}>
                {a.decision.label}
              </div>

              <div className="min-w-[180px] flex-1">
                <ul className="space-y-0 text-[10px] text-muted-foreground">
                  {a.decision.reasons.slice(0, 2).map((r, i) => (
                    <li key={i} className="flex gap-1"><span className="text-foreground">•</span> {r}</li>
                  ))}
                </ul>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 h-7 text-[10px]">
                    <Plus className="h-3 w-3" /> Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{symbol} Ekle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="qty" className="text-[10px]">Adet</Label>
                      <Input id="qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100" className="h-7 text-[11px]" />
                    </div>
                    <div className="space-y-0.5">
                      <Label htmlFor="cost" className="text-[10px]">Maliyet (TL)</Label>
                      <Input id="cost" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={last != null ? String(last) : "125.50"} className="h-7 text-[11px]" />
                    </div>
                    <Button onClick={handleAdd} className="w-full h-8 text-xs">Ekle</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Grafik + Sağda hızlı metrikler */}
          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="flex-row items-center justify-between pb-0">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <LineChart className="h-3.5 w-3.5 text-sky-500" /> FIYAT
                </CardTitle>
                <div className="flex gap-0.5">
                  {(["1mo", "3mo", "6mo", "1y"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={cn("rounded px-1.5 py-0.5 text-[10px] transition", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                    >
                      {r === "1mo" ? "1A" : r === "3mo" ? "3A" : r === "6mo" ? "6A" : "1Y"}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                {histRange.isLoading || hist.isLoading ? (
                  <Skeleton className="h-56 w-full" />
                ) : chartCandles.length > 0 ? (
                  <PriceChart
                    candles={chartCandles}
                    height={280}
                    supportLevels={a.supports.slice(0, 2).map((s) => s.price)}
                    resistanceLevels={a.resistances.slice(0, 2).map((s) => s.price)}
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-[11px] text-muted-foreground">Veri yok.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5 text-violet-500" /> GOSTERGELER
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-[10px]">
                <IndicatorRow label="RSI (14)" value={fmtNum(a.indicators.rsi14, 1)} tone={a.indicators.rsi14 != null && a.indicators.rsi14 > 70 ? "bad" : a.indicators.rsi14 != null && a.indicators.rsi14 < 30 ? "warn" : "ok"} note={(a.indicators.rsi14 ?? 50) > 70 ? "asiri alim" : (a.indicators.rsi14 ?? 50) < 30 ? "asiri satim" : ""} />
                <IndicatorRow label="MACD" value={fmtNum(a.indicators.macdHist, 3)} tone={(a.indicators.macdHist ?? 0) > 0 ? "ok" : "bad"} />
                <IndicatorRow label="EMA 20" value={fmtNum(a.indicators.ema20)} tone={last != null && last > (a.indicators.ema20 ?? 0) ? "ok" : "bad"} />
                <IndicatorRow label="EMA 50" value={fmtNum(a.indicators.ema50)} tone={last != null && last > (a.indicators.ema50 ?? 0) ? "ok" : "bad"} />
                <IndicatorRow label="EMA 200" value={fmtNum(a.indicators.ema200)} tone={last != null && last > (a.indicators.ema200 ?? 0) ? "ok" : "bad"} />
                <IndicatorRow label="ATR" value={`${fmtNum(a.indicators.atr14)} (%${fmtNum(a.indicators.atrPercent, 1)})`} tone="ok" />
                <IndicatorRow label="ADX" value={fmtNum(a.indicators.adx14, 1)} tone={(a.indicators.adx14 ?? 0) > 25 ? "ok" : "warn"} />
                <IndicatorRow label="Stokastik" value={`${fmtNum(a.indicators.stochK, 1)} / ${fmtNum(a.indicators.stochD, 1)}`} tone="ok" />
                <IndicatorRow label="Hacim/20g" value={a.indicators.volRatio ? `${fmtNum(a.indicators.volRatio * 100, 0)}%` : "—"} tone="ok" />
              </CardContent>
            </Card>
          </div>

          {/* Pozisyon planı */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Target className="h-3.5 w-3.5 text-emerald-500" /> POZISYON PLANI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
                <PlanBox label="Giris" value={`${fmtNum(a.position.entryZoneLow)} – ${fmtNum(a.position.entryZoneHigh)}`} sub="TL" tone="neutral" />
                <PlanBox label="Hedef 1" value={fmtNum(a.position.target1)} sub="TL" tone="up" />
                <PlanBox label="Hedef 2" value={fmtNum(a.position.target2)} sub="TL" tone="up" />
                <PlanBox label="Hedef 3" value={fmtNum(a.position.target3)} sub="TL" tone="up" />
                <PlanBox label="Stop" value={fmtNum(a.position.stopLoss)} sub="TL" tone="down" />
                <PlanBox label="R/R" value={`1:${fmtNum(a.position.riskReward, 1)}`} sub="senaryo" tone={a.position.riskReward >= 2 ? "up" : a.position.riskReward >= 1 ? "neutral" : "down"} />
                <PlanBox label="Trailing" value={fmtNum(a.position.trailingStop)} sub="ATR" tone="neutral" />
              </div>
              <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                <p>{a.position.positionSizeNote}</p>
                <p className="text-amber-500/90"><span className="font-semibold">Gecersizlik:</span> {a.decision.invalidation}</p>
              </div>
            </CardContent>
          </Card>

          {/* Senaryolar */}
          <div className="grid gap-3 lg:grid-cols-3">
            {a.horizons.map((h) => (
              <Card key={h.key}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs">
                    {h.label} <span className="text-[10px] font-normal text-muted-foreground">({h.duration})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {h.scenarios.map((s) => (
                    <div key={s.name} className="rounded-lg border p-2 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className={cn("font-bold", s.name === "BOĞA SENARYOSU" ? "text-emerald-500" : s.name === "AYI SENARYOSU" ? "text-red-500" : "text-foreground")}>
                          {s.name}
                        </span>
                        <Badge variant="outline" className="text-[9px]">%{s.probability}</Badge>
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold tabular-nums">
                        <span className={cn(s.changeHigh >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPctNL(s.changeLow)} → {fmtPctNL(s.changeHigh)}</span>
                        <span className="text-muted-foreground ml-2">{fmtNum(s.targetLow)} – {fmtNum(s.targetHigh)} TL</span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">{s.condition}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Profesyonel rapor + haberler */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <Brain className="h-3.5 w-3.5 text-violet-500" /> RAPOR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="genel">
                  <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="genel" className="text-[10px] h-6 px-2">Gorus</TabsTrigger>
                    <TabsTrigger value="teknik" className="text-[10px] h-6 px-2">Teknik</TabsTrigger>
                    <TabsTrigger value="temel" className="text-[10px] h-6 px-2">Temel</TabsTrigger>
                    <TabsTrigger value="haber" className="text-[10px] h-6 px-2">Haber</TabsTrigger>
                    <TabsTrigger value="sektor" className="text-[10px] h-6 px-2">Sektor</TabsTrigger>
                    <TabsTrigger value="risk" className="text-[10px] h-6 px-2">Risk</TabsTrigger>
                    <TabsTrigger value="sonuc" className="text-[10px] h-6 px-2">Sonuc</TabsTrigger>
                  </TabsList>
                  <TabsContent value="genel" className="pt-2 text-[11px] leading-relaxed">{a.narrative.genel}</TabsContent>
                  <TabsContent value="teknik" className="pt-2 text-[11px] leading-relaxed">{a.narrative.teknik}</TabsContent>
                  <TabsContent value="temel" className="pt-2 text-[11px] leading-relaxed">{a.narrative.temel}</TabsContent>
                  <TabsContent value="haber" className="pt-2 text-[11px] leading-relaxed">{a.narrative.haber}</TabsContent>
                  <TabsContent value="sektor" className="pt-2 text-[11px] leading-relaxed">{a.narrative.sektor}</TabsContent>
                  <TabsContent value="risk" className="pt-2 text-[11px] leading-relaxed">{a.narrative.risk}</TabsContent>
                  <TabsContent value="sonuc" className="pt-2 text-[11px] leading-relaxed">{a.narrative.sonuc}</TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <Newspaper className="h-3.5 w-3.5 text-sky-500" /> HABERLER
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Badge variant="outline" className={cn("text-[9px]", news.data && news.data.overallSentiment > 8 ? "text-emerald-500 border-emerald-500/30" : news.data && news.data.overallSentiment < -8 ? "text-red-500 border-red-500/30" : "")}>
                    Akis: {news.data ? (news.data.overallSentiment > 0 ? "+" : "") + news.data.overallSentiment : "—"}
                  </Badge>
                </div>
                {news.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : news.data && news.data.items.length > 0 ? (
                  <div className="max-h-56 space-y-1 overflow-y-auto terminal-scroll pr-1">
                    {news.data.items.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noreferrer" className="block rounded-md border p-1.5 text-[10px] transition hover:bg-accent">
                        <div className="flex items-start gap-1">
                          <span className={cn("mt-0.5 shrink-0 rounded px-0.5 text-[8px] font-bold", n.sentimentLabel === "OLUMLU" ? "bg-emerald-500/15 text-emerald-500" : n.sentimentLabel === "OLUMSUZ" ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground")}>
                            {n.sentimentLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 leading-snug line-clamp-2">{n.title}</p>
                        <span className="mt-0.5 block text-[9px] text-muted-foreground">
                          {n.source} · {timeAgo(n.publishedAt)}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Haber bulunamadi.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Destek/Direnç + 52 hafta */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs">DESTEK & DIRENC</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <div className="mb-1 flex items-center gap-1 font-semibold text-emerald-500"><Shield className="h-3 w-3" /> Destek</div>
                  {a.supports.length === 0 ? <span className="text-muted-foreground">Yok</span> : (
                    <div className="space-y-0.5">
                      {a.supports.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-emerald-500/5 px-1.5 py-0.5">
                          <span className="font-semibold tabular-nums">{fmtNum(s.price)} TL</span>
                          <span className="text-[9px] text-muted-foreground">{s.touches}t g:{s.strength}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1 font-semibold text-red-500"><Flame className="h-3 w-3" /> Direnc</div>
                  {a.resistances.length === 0 ? <span className="text-muted-foreground">Yok</span> : (
                    <div className="space-y-0.5">
                      {a.resistances.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-red-500/5 px-1.5 py-0.5">
                          <span className="font-semibold tabular-nums">{fmtNum(s.price)} TL</span>
                          <span className="text-[9px] text-muted-foreground">{s.touches}t g:{s.strength}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-1.5 text-xs"><Wallet className="h-3.5 w-3.5 text-sky-500" /> OZET</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-1.5 text-[10px]">
                <MetricBox label="Gunluk Y/D" value={`${fmtNum(a.quote.dayLow)} / ${fmtNum(a.quote.dayHigh)}`} />
                <MetricBox label="Onceki Kapanis" value={fmtNum(a.quote.prevClose)} />
                <MetricBox label="Hacim" value={fmtVol(a.quote.volume)} />
                <MetricBox label="52Ha Zirve" value={a.indicators.week52High != null ? fmtNum(a.indicators.week52High) : "—"} />
                <MetricBox label="52Ha Dip" value={a.indicators.week52Low != null ? fmtNum(a.indicators.week52Low) : "—"} />
                <MetricBox label="5G" value={fmtPct(a.indicators.ret5d)} tone={(a.indicators.ret5d ?? 0) >= 0 ? "up" : "down"} />
                <MetricBox label="20G" value={fmtPct(a.indicators.ret20d)} tone={(a.indicators.ret20d ?? 0) >= 0 ? "up" : "down"} />
                <MetricBox label="Zirveden" value={fmtPctNL(a.indicators.from52High)} />
              </CardContent>
            </Card>
          </div>

          {positions.find((p) => p.symbol === symbol) && (
            <p className="text-xs text-muted-foreground">
              Not: Bu hissede açık pozisyonunuz var — portföy panelinde pozisyona özel ajan değerlendirmesi (tut / azalt / çıkış) canlı fiyatla birlikte sunulur.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function IndicatorRow({ label, value, tone, note }: { label: string; value: string; tone: "ok" | "warn" | "bad"; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-border/50 pb-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cn("font-semibold tabular-nums", tone === "ok" && "text-emerald-500", tone === "warn" && "text-amber-500", tone === "bad" && "text-red-500")}>{value}</span>
        {note && <span className="text-[9px] text-muted-foreground">{note}</span>}
      </span>
    </div>
  );
}

function PlanBox({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "up" | "down" | "neutral" }) {
  return (
    <div className={cn("rounded-lg border p-1.5 text-center", tone === "up" && "border-emerald-500/30 bg-emerald-500/5", tone === "down" && "border-red-500/30 bg-red-500/5")}>
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-[11px] font-bold tabular-nums", tone === "up" && "text-emerald-500", tone === "down" && "text-red-500")}>{value}</div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function MetricBox({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-1.5">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-semibold tabular-nums text-[10px]", tone === "up" && "text-emerald-500", tone === "down" && "text-red-500")}>{value}</div>
    </div>
  );
}
