"use client";

/**
 * BUGÜN YÜKSELECEK HİSSELER — Ajanın günlük seçimleri
 * Kullanıcının doğrudan sorusuna net cevap:
 *   "Bugün hangi hisse yükselecek? Hedef kaç TL? 100 TL ile kaç TL kazandırır?"
 */

import { usePicks, type DailyPicksResponse } from "@/lib/api-client";
import { useSettings } from "@/lib/store/settings";
import { fmtNum, fmtPct, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Crosshair, Flame, MinusCircle, ShieldAlert, Target, TrendingUp } from "lucide-react";

interface Props {
  onSelectSymbol: (s: string) => void;
}

export default function TodayPicks({ onSelectSymbol }: Props) {
  const picks = usePicks();
  const minInvestment = useSettings((s) => s.minInvestment);

  if (picks.isLoading) {
    return (
      <Card className="border-violet-500/30">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (picks.isError || !picks.data) {
    return (
      <Card className="border-red-500/30">
        <CardContent className="flex items-start gap-2 p-4 text-xs text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Günlük seçimler şu anda üretilemedi — piyasa verisi bağlantısı kontrol ediliyor. Kısa süre içinde otomatik yenilenir.
        </CardContent>
      </Card>
    );
  }

  const d: DailyPicksResponse = picks.data;
  const msIcon = d.marketStatus.open ? <Flame className="h-3.5 w-3.5 text-orange-500" /> : <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <div className="space-y-3">
      {/* Başlık şeridi */}
      <Card className="border-violet-500/40 bg-gradient-to-r from-violet-500/10 via-transparent to-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 shrink-0 text-violet-500" />
              <h2 className="text-base font-bold tracking-tight">BUGÜN YÜKSELECEK HİSSELER</h2>
              <Badge variant="outline" className="text-[10px]">AJANIN GÜNLÜK SEÇİMİ</Badge>
            </div>
            <p className="mt-1 text-xs font-medium text-violet-600 dark:text-violet-400">{d.headline}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              {msIcon} {d.marketStatus.session} · {d.marketStatus.nextEvent} · güncellendi {timeAgo(d.generatedAt)}
            </p>
          </div>
          <div className="text-end text-[11px] text-muted-foreground">
            <div className="font-semibold text-foreground">Rejim: {d.regime.label}</div>
            <div>Her seçimde stop + geçersizlik koşulu belirtilir</div>
          </div>
        </CardContent>
      </Card>

      {/* Seçim kartları */}
      {d.picks.length === 0 ? (
        <Card>
          <CardContent className="flex items-start gap-2 p-4 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            Bugün yeterli güvene sahip yükseliş fırsatı bulunamadı ({d.regime.label} piyasası). Piyasada net yön yokken beklemek en doğru hamledir — ajan koşullar oluştuğunda otomatik günceller.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {d.picks.map((p, i) => (
            <PickCard key={p.symbol} pick={p} rank={i + 1} minInvestment={minInvestment} onSelect={onSelectSymbol} />
          ))}
        </div>
      )}

      {/* Uzak durulacaklar */}
      {d.avoid.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-500">
              <ShieldAlert className="h-3.5 w-3.5" /> BUGÜN UZAK DURULMASI UYGUN OLANLAR
            </div>
            <div className="space-y-1">
              {d.avoid.map((a) => (
                <button key={a.symbol} onClick={() => onSelectSymbol(a.symbol)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-start text-xs transition hover:bg-accent">
                  <span className="font-bold">{a.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.reason}</span>
                  <span className="shrink-0 tabular-nums text-red-500">{fmtPct(a.changePercent)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">{d.sourceNote} {d.disclaimer}</p>
    </div>
  );
}

function PickCard({ pick: p, rank, minInvestment, onSelect }: { pick: DailyPicksResponse["picks"][number]; rank: number; minInvestment: number; onSelect: (s: string) => void }) {
  const confColor = p.confidence >= 65 ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : p.confidence >= 50 ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : "text-muted-foreground border-border bg-muted";
  const invested = Math.max(minInvestment, 100);
  return (
    <Card className="group overflow-hidden border-emerald-500/20 transition hover:border-emerald-500/50">
      <CardContent className="p-0">
        <button onClick={() => onSelect(p.symbol)} className="w-full text-start">
          {/* Üst şerit: sembol + hedef */}
          <div className="flex items-center justify-between gap-2 border-b bg-emerald-500/5 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-500">{rank}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold">{p.symbol}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="font-semibold text-emerald-500">{p.direction}</span>
                  <span>· şu an {fmtNum(p.price)} TL ({fmtPct(p.changePercent)})</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-end">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bugünün hedefi</div>
              <div className="text-lg font-bold tabular-nums text-emerald-500">{fmtNum(p.todayTarget)} TL</div>
              <div className="text-[11px] font-semibold tabular-nums text-emerald-500">+{fmtNum(p.todayTargetPct)}%</div>
            </div>
          </div>

          {/* Kazanç hesabı */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2.5">
            <MiniStat label={`📊 ${invested} TL ile kazanç`} value={`+${fmtNum((invested * p.todayTargetPct) / 100)} TL`} sub={`güçlü gün: +${fmtNum((invested * p.todayTargetHighPct) / 100)} TL`} tone="up" />
            <MiniStat label="🎯 1 hafta hedefi" value={`${fmtNum(p.weekTarget)} TL`} sub={`+${fmtNum(p.weekTargetPct)}%`} />
            <MiniStat label="🛑 Stop (risk)" value={`${fmtNum(p.stopLoss)} TL`} sub={`R/R ${p.riskReward}`} tone="down" />
          </div>

          {/* Gerekçe + plan */}
          <div className="space-y-1.5 border-t px-3 py-2.5 text-[11px] leading-relaxed">
            <p className="text-foreground/90">{p.reason}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Crosshair className="h-3 w-3" /> Giriş: {fmtNum(p.entryLow)}–{fmtNum(p.entryHigh)} TL</span>
              <span>RSI {p.rsi != null ? fmtNum(p.rsi, 1) : "—"}</span>
              <span>Hacim ×{p.volumeRatio != null ? fmtNum(p.volumeRatio, 2) : "—"}</span>
              {p.perfWeek != null && <span>1 hafta: {fmtPct(p.perfWeek)}</span>}
            </div>
            <p className="text-muted-foreground">⚠️ {p.invalidation}</p>
          </div>

          {/* Güven şeridi */}
          <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ajan güveni</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", p.confidence >= 65 ? "bg-emerald-500" : p.confidence >= 50 ? "bg-amber-500" : "bg-zinc-400")} style={{ width: `${p.confidence}%` }} />
              </div>
            </div>
            <Badge variant="outline" className={cn("text-[10px] font-bold", confColor)}>%{p.confidence} GÜVEN</Badge>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", tone === "up" && "text-emerald-500", tone === "down" && "text-red-500")}>{value}</div>
      {sub && <div className="text-[10px] tabular-nums text-muted-foreground">{sub}</div>}
    </div>
  );
}
