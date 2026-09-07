"use client";

/**
 * Portföy Paneli — pozisyon takibi, günlük/haftalık kâr-zarar, smart exit değerlendirmesi
 * Minimum yatırım: 100 TL
 */

import { useQuery } from "@tanstack/react-query";
import { usePortfolio, type Position } from "@/lib/store/portfolio";
import { useSettings } from "@/lib/store/settings";
import { useQuotes, useMarket } from "@/lib/api-client";
import { testNotificationPermission } from "@/lib/alerts/engine";
import { fmtNum, fmtPct, fmtPctNL, fmtTL, fmtVol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, CircleAlert, PiggyBank, Plus, RefreshCw, ShieldAlert, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { SYMBOLS, BIST_UNIVERSE } from "@/lib/market/symbols";

interface PositionEval {
  symbol: string;
  advice: {
    action: string;
    headline: string;
    detail: string;
    analysis: string[];
    trailingStop: number;
  };
  metrics: {
    price: number;
    gainPct: number;
    dailyChangePct: number;
    weeklyChangePct: number | null;
    monthlyChangePct: number | null;
    totalPL: number;
    dailyPL: number;
    weeklyPL: number | null;
  };
  decision: { code: string; label: string; reasons: string[] };
  position: { stopLoss: number; target1: number; riskReward: number };
  dataNote?: string;
}

function usePositionEval(positions: Position[], enabled: boolean) {
  const key = positions.map((p) => `${p.symbol}:${p.avgCost}:${p.quantity}`).join("|");
  return useQuery<Record<string, PositionEval>>({
    queryKey: ["position-evals", key],
    queryFn: async () => {
      const results = await Promise.all(
        positions.map(async (p) => {
          try {
            const res = await fetch(`/api/position-eval?symbol=${p.symbol}&entry=${p.avgCost}&qty=${p.quantity}`);
            if (!res.ok) throw new Error("değerlendirilemedi");
            const data = (await res.json()) as PositionEval;
            return [p.id, data] as const;
          } catch {
            return [p.id, null] as const;
          }
        })
      );
      const map: Record<string, PositionEval> = {};
      for (const [id, data] of results) if (data) map[id] = data;
      return map;
    },
    enabled: enabled && positions.length > 0,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export default function PortfolioView({ onSelectSymbol }: { onSelectSymbol: (s: string) => void }) {
  const { positions, addPosition, closePosition, removePosition } = usePortfolio();
  const { toast } = useToast();
  const settings = useSettingsState();
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [notifyState, setNotifyState] = useState<string>("");

  const quotes = useQuotes(positions.map((p) => p.symbol), 60_000);
  const evals = usePositionEval(positions, true);
  const market = useMarket();

  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== "undefined" && "Notification" in window) {
        setNotifyState(Notification.permission);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const enableNotifications = async () => {
    const perm = await testNotificationPermission();
    setNotifyState(perm);
    if (perm === "granted") toast({ title: "Bildirimler açık", description: "Kâr/zarar uyarıları artık telefonunuza ve tarayıcınıza gelecek." });
    else toast({ title: "Bildirim izni verilmedi", description: "Tarayıcı ayarlarından bildirimlere izin vermeniz gerekebilir.", variant: "destructive" });
  };

  const totals = useMemo(() => {
    let cost = 0;
    let value = 0;
    let daily = 0;
    let weekly = 0;
    let hasWeekly = false;
    for (const p of positions) {
      const q = quotes.data?.quotes[p.symbol];
      const ev = evals.data?.[p.id];
      if (!q) continue;
      cost += p.quantity * p.avgCost;
      value += p.quantity * q.price;
      daily += p.quantity * q.change;
      if (ev?.metrics.weeklyPL != null) {
        weekly += ev.metrics.weeklyPL;
        hasWeekly = true;
      }
    }
    return { cost, value, daily, weekly, hasWeekly, pl: value - cost };
  }, [positions, quotes.data, evals.data]);

  // Sektör dağılımı
  const sectorDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) {
      const q = quotes.data?.quotes[p.symbol];
      if (!q) continue;
      const meta = BIST_UNIVERSE.find((s) => s.symbol === p.symbol);
      const sector = meta?.sector ?? "Diğer";
      map.set(sector, (map.get(sector) ?? 0) + p.quantity * q.price);
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return [...map.entries()]
      .map(([sector, value]) => ({ sector, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [positions, quotes.data]);

  const handleSubmit = () => {
    const meta = BIST_UNIVERSE.find((s) => s.symbol === symbol.toUpperCase());
    if (!symbol) {
      toast({ title: "Hata", description: "Hisse seçin.", variant: "destructive" });
      return;
    }
    const res = addPosition({
      symbol,
      name: meta?.name ?? symbol,
      quantity: Number(qty),
      avgCost: Number(cost),
    });
    if (res.ok) {
      toast({ title: "Pozisyon eklendi", description: `${symbol} artık canlı izleniyor. Düşüş, kâr hedefi ve stop uyarıları aktif.` });
      setSymbol("");
      setQty("");
      setCost("");
    } else {
      toast({ title: "Eklenemedi", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Özet */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <PiggyBank className="h-3.5 w-3.5 text-emerald-500" /> PORTFOY OZETI
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              Pozisyon yok. Asagidaki formdan ekleyin (min 100 TL).
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <TotalBox label="Yatirim" value={fmtTL(totals.cost)} />
              <TotalBox label="Deger" value={fmtTL(totals.value)} />
              <TotalBox label="Gunluk K/Z" value={`${totals.daily >= 0 ? "+" : "-"}${fmtTL(Math.abs(totals.daily))}`} tone={totals.daily >= 0 ? "up" : "down"} />
              <TotalBox label="Haftalik K/Z" value={totals.hasWeekly ? `${totals.weekly >= 0 ? "+" : "-"}${fmtTL(Math.abs(totals.weekly))}` : "—"} tone={totals.weekly >= 0 ? "up" : "down"} />
              <TotalBox label="Toplam K/Z" value={`${totals.pl >= 0 ? "+" : "-"}${fmtTL(Math.abs(totals.pl))}`} tone={totals.pl >= 0 ? "up" : "down"} sub={totals.cost > 0 ? fmtPctNL((totals.pl / totals.cost) * 100) : undefined} />
            </div>
          )}
          {positions.length > 0 && sectorDist.length > 0 && (
            <div className="mt-2 border-t pt-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                {sectorDist.map((s, i) => (
                  <div
                    key={i}
                    className="h-full"
                    style={{ width: `${s.pct}%`, backgroundColor: `hsl(${(i * 67 + 150) % 360} 55% 45%)` }}
                    title={`${s.sector}: %${s.pct.toFixed(1)}`}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pozisyon ekleme */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5 text-sky-500" /> POZISYON EKLE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto]">
            <div className="space-y-0.5">
              <Label className="text-[10px]">Hisse</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-full h-7 text-[11px]">
                  <SelectValue placeholder="Secin" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {SYMBOLS.map((s) => {
                    const meta = BIST_UNIVERSE.find((u) => u.symbol === s);
                    return (
                      <SelectItem key={s} value={s} className="text-[11px]">
                        {s} — {meta?.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Adet</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100" className="h-7 text-[11px]" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Maliyet (TL)</Label>
              <Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="125.50" className="h-7 text-[11px]" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSubmit} className="w-full sm:w-auto h-7 text-[10px]">
                Ekle
              </Button>
            </div>
          </div>
          {qty && cost && Number(qty) * Number(cost) > 0 && Number(qty) * Number(cost) < 100 && (
            <p className="mt-1 text-[10px] text-red-500">
              Min 10 TL
            </p>
          )}

          {/* Bildirim durumu */}
          <div className="mt-2 rounded-lg border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <BellRing className="h-3 w-3 text-amber-500" />
              {notifyState === "granted" ? (
                <Badge variant="outline" className="text-[9px] text-emerald-500 border-emerald-500/30"><CheckCircle2 className="me-0.5 h-2 w-2" />Acik</Badge>
              ) : (
                <Badge variant="outline" className="text-[9px]">Kapali</Badge>
              )}
              <Button size="sm" variant="outline" className="h-5 text-[9px]" onClick={enableNotifications}>Ac</Button>
              <span className="text-muted-foreground">
                %{settings.dropAlertPct} dusus / +%{settings.riseAlertPct} yukaris / +%{settings.targetAlertPct} kar
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pozisyonlar */}
      <div className="space-y-2">
        {quotes.isLoading && positions.length > 0 && <Skeleton className="h-24 w-full" />}
        {positions.map((p) => (
          <PositionCard
            key={p.id}
            position={p}
            evalData={evals.data?.[p.id]}
            quote={quotes.data?.quotes[p.symbol]}
            onSelect={onSelectSymbol}
            onClose={(price) => {
              closePosition(p.id, price, "Manuel kapatma");
              toast({ title: "Kapatildi", description: `${p.symbol} @ ${fmtNum(price)} TL` });
            }}
            onRemove={() => {
              removePosition(p.id);
              toast({ title: "Kaldirildi" });
            }}
          />
        ))}
      </div>

      {market.data && <p className="text-[9px] text-muted-foreground">{market.data.sourceNote}</p>}
    </div>
  );
}

function PositionCard({
  position: p,
  evalData,
  quote,
  onSelect,
  onClose,
  onRemove,
}: {
  position: Position;
  evalData?: PositionEval;
  quote?: { price: number; changePercent: number; volume: number };
  onSelect: (s: string) => void;
  onClose: (price: number) => void;
  onRemove: () => void;
}) {
  const [confirmClose, setConfirmClose] = useState(false);
  const m = evalData?.metrics;
  const totalPL = quote ? (quote.price - p.avgCost) * p.quantity : null;
  const totalPct = quote ? ((quote.price - p.avgCost) / p.avgCost) * 100 : null;

  const actionTone: Record<string, string> = {
    BEKLE: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    RISK_AZALT: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    CIKISI_DEGERLENDIR: "bg-red-500/15 text-red-500 border-red-500/30",
    KADEMELI_KAR: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    TRAILING_STOP: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  };

  return (
    <Card className={cn("border-l-3", totalPct == null ? "" : totalPct >= 0 ? "border-l-emerald-500/60" : "border-l-red-500/60")}>
      <CardContent className="p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <div>
            <button onClick={() => onSelect(p.symbol)} className="text-start">
              <span className="text-xs font-bold hover:underline">{p.symbol}</span>
              <span className="ms-1 text-[10px] text-muted-foreground">{p.name}</span>
            </button>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {p.quantity} adet @ {fmtNum(p.avgCost)} TL
            </div>
          </div>
          <div className="text-end">
            {quote && (
              <>
                <div className="text-sm font-bold tabular-nums">{fmtTL(quote.price)}</div>
                <div className={cn("text-[10px] font-semibold tabular-nums", quote.changePercent >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtPct(quote.changePercent)}</div>
              </>
            )}
          </div>
        </div>

        {/* K/Z şeridi */}
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MiniStat label="Toplam K/Z" value={totalPL != null ? `${totalPL >= 0 ? "+" : "-"}${fmtTL(Math.abs(totalPL))}` : "—"} tone={totalPL != null && totalPL >= 0 ? "up" : "down"} sub={totalPct != null ? fmtPctNL(totalPct) : undefined} />
          <MiniStat label="Gun" value={m ? `${m.dailyPL >= 0 ? "+" : "-"}${fmtTL(Math.abs(m.dailyPL))}` : "—"} tone={m ? (m.dailyPL >= 0 ? "up" : "down") : undefined} sub={m ? fmtPctNL(m.dailyChangePct) : undefined} />
          <MiniStat label="Hafta" value={m?.weeklyPL != null ? `${m.weeklyPL >= 0 ? "+" : "-"}${fmtTL(Math.abs(m.weeklyPL))}` : "—"} tone={m?.weeklyPL != null ? (m.weeklyPL >= 0 ? "up" : "down") : undefined} />
          <MiniStat label="Trailing" value={evalData ? fmtTL(evalData.advice.trailingStop) : "—"} tone="neutral" />
        </div>

        {/* Smart exit değerlendirmesi */}
        {evalData ? (
          <div className={cn("mt-2 rounded-lg border p-2 text-[10px]", actionTone[evalData.advice.action] ?? "")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn("text-[9px] font-bold", actionTone[evalData.advice.action] ?? "")}>
                {evalData.advice.action.replace(/_/g, " ")}
              </Badge>
              <span className="font-semibold text-foreground">{evalData.advice.headline}</span>
            </div>
            <p className="mt-1 leading-relaxed text-foreground/90 line-clamp-2">{evalData.advice.detail}</p>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Hesaplaniyor...
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-1.5">
          {confirmClose ? (
            <>
              <span className="text-[10px]">{quote ? fmtNum(quote.price) : "—"} TL</span>
              <Button size="sm" variant="destructive" className="h-6 text-[9px]" onClick={() => quote && onClose(quote.price)} disabled={!quote}>Evet</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={() => setConfirmClose(false)}>Iptal</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={() => setConfirmClose(true)} disabled={!quote}>Kapat</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[9px] text-muted-foreground" onClick={onRemove}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[9px]" onClick={() => onSelect(p.symbol)}>Analiz</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TotalBox({ label, value, tone, sub }: { label: string; value: string; tone?: "up" | "down"; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xs font-bold tabular-nums", tone === "up" && "text-emerald-500", tone === "down" && "text-red-500")}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone, sub }: { label: string; value: string; tone?: "up" | "down" | "neutral"; sub?: string }) {
  return (
    <div className="rounded-md border p-1.5">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={cn("text-[10px] font-bold tabular-nums", tone === "up" && "text-emerald-500", tone === "down" && "text-red-500")}>{value}</div>
      {sub && <div className={cn("text-[9px] tabular-nums", tone === "up" ? "text-emerald-500/80" : tone === "down" ? "text-red-500/80" : "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}

function useSettingsState() {
  return useSettings();
}
