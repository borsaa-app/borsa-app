"use client";

/**
 * Ana Dashboard:
 * - Piyasa durumu (rejim kartı)
 * - AI'nın bugünkü en güçlü fırsatları (scan)
 * - Portföy özeti
 * - Canlı uyarılar
 * - Piyasa haberleri
 */

import { useScan, useMarket, useQuotes, useNews } from "@/lib/api-client";
import { usePortfolio } from "@/lib/store/portfolio";
import { fmtNum, fmtPct, fmtPctNL, fmtTL, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TodayPicks from "./TodayPicks";
import { ArrowRight, Brain, Flame, Gauge, Newspaper, PiggyBank, Search, TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  onSelectSymbol: (s: string) => void;
  onNavigate: (v: "portfolio" | "scanner" | "news" | "settings") => void;
}

export default function Dashboard({ onSelectSymbol, onNavigate }: Props) {
  const scan = useScan(true);
  const market = useMarket();
  const news = useNews("", 8);
  const positions = usePortfolio((s) => s.positions);
  const quotes = useQuotes(positions.map((p) => p.symbol), 60_000);

  const top = scan.data?.lists.bestOpportunities ?? [];
  const momentum = scan.data?.lists.strongestMomentum ?? [];
  const losers = scan.data?.lists.biggestLosers ?? [];
  const regime = market.data?.regime;

  // Portföy özeti hesapları (gerçek fiyatlama ile)
  let totalCost = 0;
  let totalValue = 0;
  let dailyPL = 0;
  for (const p of positions) {
    const q = quotes.data?.quotes[p.symbol];
    if (!q) continue;
    totalCost += p.quantity * p.avgCost;
    totalValue += p.quantity * q.price;
    dailyPL += p.quantity * q.change;
  }
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* BUGÜN YÜKSELECEK HİSSELER */}
      <TodayPicks onSelectSymbol={onSelectSymbol} />

      {/* Piyasa durumu + Portföy özeti — 3 kolon yoğun grid */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Gauge className="h-3.5 w-3.5 text-sky-500" /> PİYASA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {market.isLoading ? (
              <>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-full" />
              </>
            ) : regime ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold">{regime.label}</span>
                  <span className={cn("tabular-nums text-[11px]", regime.bist100Trend === "yukari" ? "text-emerald-500" : regime.bist100Trend === "asagi" ? "text-red-500" : "text-muted-foreground")}>
                    20g: {fmtPct(regime.bist100Change)}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">{regime.description}</p>
                <p className="border-t pt-1.5 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Ajan:</span> {regime.advice}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-red-500">Veri baglantisi aktif degil.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <PiggyBank className="h-3.5 w-3.5 text-emerald-500" /> PORTFÖY
            </CardTitle>
            <button onClick={() => onNavigate("portfolio")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              Git <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="flex h-[60px] flex-col items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
                <span>Pozisyon yok.</span>
                <button onClick={() => onNavigate("portfolio")} className="text-sky-500 hover:underline">
                  Ilk pozisyonu ekleyin
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Deger" value={fmtTL(totalValue)} />
                <Stat label="Gunluk K/Z" value={`${dailyPL >= 0 ? "+" : "-"}${fmtTL(Math.abs(dailyPL))}`} tone={dailyPL >= 0 ? "up" : "down"} />
                <Stat label="Toplam K/Z" value={`${totalPL >= 0 ? "+" : "-"}${fmtTL(Math.abs(totalPL))}`} tone={totalPL >= 0 ? "up" : "down"} sub={fmtPctNL(totalPLPct)} />
                <Stat label="Pozisyon" value={`${positions.length} hisse`} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* En güçlü fırsatlar */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Brain className="h-3.5 w-3.5 text-violet-500" /> AI FIRSATLARI
          </CardTitle>
          <button onClick={() => onNavigate("scanner")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            <Search className="h-2.5 w-2.5" /> Tum liste
          </button>
        </CardHeader>
        <CardContent>
          {scan.isLoading ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : scan.isError ? (
            <p className="text-[11px] text-red-500">Tarama yapilamadi.</p>
          ) : top.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Uygun hisse yok.</p>
          ) : (
            <div className="space-y-1">
              {top.slice(0, 5).map((r, i) => (
                <OpportunityRow key={r.symbol} rank={i + 1} row={r} onSelect={onSelectSymbol} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Momentum + Düşenler */}
      <div className="grid gap-3 md:grid-cols-2">
        <MiniList
          title="MOMENTUM"
          icon={<Flame className="h-3.5 w-3.5 text-orange-500" />}
          rows={momentum.slice(0, 6)}
          onSelect={onSelectSymbol}
          loading={scan.isLoading}
        />
        <MiniList
          title="DUSENLER"
          icon={<TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          rows={losers.slice(0, 6)}
          onSelect={onSelectSymbol}
          loading={scan.isLoading}
        />
      </div>

      {/* Haberler */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Newspaper className="h-3.5 w-3.5 text-sky-500" /> HABERLER
          </CardTitle>
          <button onClick={() => onNavigate("news")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            Tum <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </CardHeader>
        <CardContent>
          {news.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : news.data && news.data.items.length > 0 ? (
            <div className="space-y-1">
              {news.data.items.slice(0, 4).map((n, i) => (
                <a
                  key={i}
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md border-l-2 border-transparent px-2 py-1 text-[11px] transition hover:border-sky-500 hover:bg-accent"
                >
                  <div className="flex items-start gap-1.5">
                    <span className={cn("mt-0.5 shrink-0 rounded px-1 text-[9px] font-semibold", n.sentimentLabel === "OLUMLU" ? "bg-emerald-500/15 text-emerald-500" : n.sentimentLabel === "OLUMSUZ" ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground")}>
                      {n.sentimentLabel}
                    </span>
                    <span className="line-clamp-1">{n.title}</span>
                  </div>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">
                    {n.source} · {timeAgo(n.publishedAt)}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Haber yok.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "up" | "down"; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xs font-bold tabular-nums", tone === "up" && "text-emerald-500", tone === "down" && "text-red-500")}>{value}</div>
      {sub && <div className={cn("text-[9px] tabular-nums", tone === "up" ? "text-emerald-500" : tone === "down" ? "text-red-500" : "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

function OpportunityRow({ rank, row, onSelect }: { rank: number; row: { symbol: string; name: string; price: number; changePercent: number; score: number; reason: string; rsi: number | null }; onSelect: (s: string) => void }) {
  const scoreLabel = row.score >= 85 ? "GÜÇLÜ" : row.score >= 70 ? "İYİ" : row.score >= 55 ? "ORTA" : "ZAYIF";
  const scoreColor = row.score >= 70 ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : row.score >= 55 ? "bg-amber-500/15 text-amber-500 border-amber-500/30" : "bg-muted text-muted-foreground border-border";
  return (
    <button
      onClick={() => onSelect(row.symbol)}
      className="group flex w-full items-center gap-2 rounded-lg border p-2 text-start transition hover:border-violet-500/40 hover:bg-violet-500/5"
    >
      <span className="w-4 shrink-0 text-center text-[11px] font-bold text-muted-foreground">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-[11px] font-bold">{row.symbol}</span>
          <span className="truncate text-[10px] text-muted-foreground">{row.name}</span>
          <span className="tabular-nums text-[11px] font-semibold">{fmtNum(row.price)} TL</span>
          <span className={cn("text-[10px] tabular-nums", row.changePercent >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPct(row.changePercent)}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{row.reason}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant="outline" className={cn("text-[9px] font-bold", scoreColor)}>
          {row.score} {scoreLabel}
        </Badge>
        <TrendingUp className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>
    </button>
  );
}

function MiniList({ title, icon, rows, onSelect, loading }: { title: string; icon: React.ReactNode; rows: Array<{ symbol: string; name: string; price: number; changePercent: number; reason: string }>; onSelect: (s: string) => void; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1.5 text-xs">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Veri yok.</p>
        ) : (
          <div className="space-y-0.5">
            {rows.map((r) => (
              <button key={r.symbol} onClick={() => onSelect(r.symbol)} className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-start text-[11px] transition hover:bg-accent">
                <span className="font-bold">{r.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.name}</span>
                <span className="tabular-nums">{fmtNum(r.price)}</span>
                <span className={cn("w-12 text-end tabular-nums", r.changePercent >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPct(r.changePercent)}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
