"use client";

/**
 * Piyasa Tarayıcı — AI'nın ürettiği 8 liste, her satırda "neden" açıklaması
 */

import { useScan } from "@/lib/api-client";
import { fmtNum, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Flame, Gauge, Rocket, SearchX, ShieldCheck, Skull, Sparkles, Target, TrendingDown } from "lucide-react";
import { useState } from "react";

type ListKey = "bestOpportunities" | "strongestMomentum" | "biggestLosers" | "recoveryCandidates" | "lowestRisk" | "highRiskHighReward" | "oversoldBounce" | "nearResistance";

const LISTS: Array<{ key: ListKey; title: string; icon: React.ReactNode; note: string }> = [
  { key: "bestOpportunities", title: "BUGÜNÜN EN İYİ FIRSATLARI", icon: <Sparkles className="h-4 w-4 text-violet-500" />, note: "Teknik + momentum + hacim + rejim ağırlıklı bileşik skor. Skor 100 üzerinden verilmektedir; ağırlıklar piyasa rejimine göre dinamiktir." },
  { key: "strongestMomentum", title: "EN GÜÇLÜ MOMENTUM", icon: <Flame className="h-4 w-4 text-orange-500" />, note: "RSI ve hacim oranına göre. Momentum güçlü hisseler trend devamı için izlenir; ancak dirence yakın olanlarda geri çekilme riski vardır." },
  { key: "biggestLosers", title: "EN ÇOK DÜŞENLER", icon: <TrendingDown className="h-4 w-4 text-red-500" />, note: "Günlük en çok düşenler. Düşüşün nedeni haber mi, piyasa geneli mi, hisseye özel mi — detay raporunda incelenmelidir." },
  { key: "recoveryCandidates", title: "TOPARLANMA İHTİMALİ YÜKSEKLER", icon: <Rocket className="h-4 w-4 text-sky-500" />, note: "Zirveden belirgin uzaklaşmış ancak RSI 40-60 bandında toparlanma bölgesinde görünen hisseler. Trend dönüşü teyidi beklenir." },
  { key: "lowestRisk", title: "EN DÜŞÜK RİSKLİLER", icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />, note: "52 hafta zirvesine en yakın (göreli güçlü) hisseler. Zirveye yakın fiyat, pazarın bu hisseye güven duyduğunu gösterir." },
  { key: "highRiskHighReward", title: "YÜKSEK RİSK / YÜKSEK GETİRİ", icon: <Skull className="h-4 w-4 text-amber-500" />, note: "Olağandışı hacim veya sert fiyat hareketi olan hisseler. Sadece risk yönetimi (stop, küçük pozisyon) ile yaklaşılmalıdır." },
  { key: "oversoldBounce", title: "AŞIRI SATIM — TEPKİ ADAYLARI", icon: <Gauge className="h-4 w-4 text-cyan-500" />, note: "RSI 35 altı hisseler. Aşırı satım bölgesi tepki alımı potansiyeli taşır; ancak düşmeye devam edebilir — tek gösterge karar verdirmez." },
  { key: "nearResistance", title: "DİRENÇ YAKINI — KIRILIM İZLEYENLER", icon: <Target className="h-4 w-4 text-pink-500" />, note: "İlk dirence %3'ten yakın hisseler. Hacimli kırılım momentum başlangıcı olabilir; teyitsiz kırılımlar fake çıkabilir." },
];

export default function ScannerView({ onSelectSymbol }: { onSelectSymbol: (s: string) => void }) {
  const scan = useScan(true);
  const [active, setActive] = useState<ListKey>("bestOpportunities");

  const regime = scan.data?.regime;
  const rows = scan.data?.lists[active] ?? [];
  const activeMeta = LISTS.find((l) => l.key === active);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex flex-wrap items-center gap-1.5 text-xs">
            <SearchX className="h-3.5 w-3.5 text-sky-500" /> TARAMA
            {regime && (
              <Badge variant="outline" className="text-[9px]">
                Rejim: {regime.label}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {LISTS.map((l) => (
              <button
                key={l.key}
                onClick={() => setActive(l.key)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition",
                  active === l.key ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {l.icon} {l.title}
              </button>
            ))}
          </div>
          {activeMeta && <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">{activeMeta.note}</p>}
        </CardContent>
      </Card>

      {scan.isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : scan.isError ? (
        <Card className="border-red-500/40">
          <CardContent className="flex items-center gap-2 p-2.5 text-[11px] text-red-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Tarama yapilamadi.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-muted-foreground">Uygun hisse yok.</p>
            ) : (
              <div className="divide-y">
                {rows.map((r, i) => (
                  <button key={r.symbol} onClick={() => onSelectSymbol(r.symbol)} className="flex w-full items-center gap-2 p-2 text-start transition hover:bg-accent">
                    <span className="w-4 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span className="text-[11px] font-bold">{r.symbol}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{r.name}</span>
                        <Badge variant="outline" className="text-[8px]">{r.sector}</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{r.reason}</p>
                    </div>
                    <div className="hidden shrink-0 gap-2 text-[10px] text-muted-foreground sm:flex">
                      <span>RSI:{r.rsi != null ? fmtNum(r.rsi, 1) : "—"}</span>
                      <span>H:{r.volumeRatio != null ? `${Math.round(r.volumeRatio * 100)}%` : "—"}</span>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className="text-[11px] font-semibold tabular-nums">{fmtNum(r.price)} TL</div>
                      <div className={cn("text-[10px] tabular-nums", r.changePercent >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPct(r.changePercent)}</div>
                    </div>
                    {r.score >= 0 && (
                      <div className={cn("w-10 shrink-0 rounded-md p-0.5 text-center", r.score >= 70 ? "bg-emerald-500/15 text-emerald-500" : r.score >= 55 ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground")}>
                        <div className="text-[10px] font-bold">{r.score}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {scan.data && (
        <p className="text-[10px] text-muted-foreground">
          {scan.data.sourceNote} · Taranan hisse: {scan.data.scanned} · Tarama zamanı: {new Date(scan.data.fetchedAt).toLocaleTimeString("tr-TR")}
          {scan.data.errors.length > 0 && ` · Veri alınamayan hisse: ${scan.data.errors.length} (uydurma yapılmadı, bu hisseler listelere alınmadı)`}
        </p>
      )}
    </div>
  );
}
