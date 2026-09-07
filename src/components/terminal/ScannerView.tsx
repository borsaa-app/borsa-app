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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <SearchX className="h-4 w-4 text-sky-500" /> PİYASA TARAMASI
            {regime && (
              <Badge variant="outline" className="text-[10px]">
                Rejim: {regime.label} — {regime.type === "dusus" || regime.type === "panik" ? "alım skorları temkinli" : regime.type === "guclu_yukselis" ? "momentum ağırlığı artırıldı" : "standart ağırlık"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {LISTS.map((l) => (
              <button
                key={l.key}
                onClick={() => setActive(l.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
                  active === l.key ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {l.icon} {l.title}
              </button>
            ))}
          </div>
          {activeMeta && <p className="mt-2 text-xs text-muted-foreground">{activeMeta.note}</p>}
        </CardContent>
      </Card>

      {scan.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : scan.isError ? (
        <Card className="border-red-500/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-500">
            <AlertTriangle className="h-4 w-4" /> Tarama şu anda yapılamadı. Veri kaynağına ulaşılamıyor olabilir; birkaç dakika sonra tekrar deneyin.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Bu listede şu an uygun hisse bulunamadı.</p>
            ) : (
              <div className="divide-y">
                {rows.map((r, i) => (
                  <button key={r.symbol} onClick={() => onSelectSymbol(r.symbol)} className="flex w-full items-center gap-3 p-3 text-start transition hover:bg-accent">
                    <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-bold">{r.symbol}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.name}</span>
                        <Badge variant="outline" className="text-[9px]">{r.sector}</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.reason}</p>
                    </div>
                    <div className="hidden shrink-0 gap-3 text-[11px] text-muted-foreground sm:flex">
                      <span>RSI: {r.rsi != null ? fmtNum(r.rsi, 1) : "—"}</span>
                      <span>Hacim: {r.volumeRatio != null ? `${Math.round(r.volumeRatio * 100)}%` : "—"}</span>
                      <span>D: {r.support != null ? fmtNum(r.support) : "—"}</span>
                      <span>R: {r.resistance != null ? fmtNum(r.resistance) : "—"}</span>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className="text-sm font-semibold tabular-nums">{fmtNum(r.price)} TL</div>
                      <div className={cn("text-xs tabular-nums", r.changePercent >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPct(r.changePercent)}</div>
                    </div>
                    {r.score >= 0 && (
                      <div className={cn("w-12 shrink-0 rounded-md p-1 text-center", r.score >= 70 ? "bg-emerald-500/15 text-emerald-500" : r.score >= 55 ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground")}>
                        <div className="text-xs font-bold">{r.score}</div>
                        <div className="text-[8px]">SKOR</div>
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
