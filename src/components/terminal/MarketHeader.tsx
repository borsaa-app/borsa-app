"use client";

/** Üst piyasa durumu çubuğu — BIST 100, kur, altın, petrol, rejim, veri durumu */

import { useMarket, useMarketClock } from "@/lib/api-client";
import { fmtNum, fmtPct, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, Clock } from "lucide-react";

export default function MarketHeader() {
  const { data, isLoading } = useMarket();
  const clock = useMarketClock();

  const idx = data?.indices;
  const regime = data?.regime;

  const regimeColor =
    regime?.type === "guclu_yukselis" || regime?.type === "yukselis"
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : regime?.type === "dusus" || regime?.type === "panik"
        ? "text-red-400 border-red-500/40 bg-red-500/10"
        : "text-amber-400 border-amber-500/40 bg-amber-500/10";

  return (
    <div className="border-b bg-card/60 backdrop-blur">
      <div className="mx-auto max-w-[1500px] px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-sm">
            <Activity className="h-4 w-4 text-emerald-500" />
            BIST AI Terminal
          </div>

          <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-0.5", clock.open ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : "text-muted-foreground border-border bg-muted/40")}>
            <Clock className="h-3 w-3" />
            {clock.label}
          </div>

          {isLoading && <span className="text-muted-foreground">Piyasa yükleniyor…</span>}

          {idx?.bist100 && (
            <IndexChip name="BIST 100" quote={idx.bist100} strong />
          )}
          {idx?.usdtry && <IndexChip name="Dolar/TL" quote={idx.usdtry} invert />}
          {idx?.gold && <IndexChip name="Altın (ons)" quote={idx.gold} />}
          {idx?.brent && <IndexChip name="Brent" quote={idx.brent} />}

          <div className="ms-auto flex flex-wrap items-center gap-2">
            {regime && regime.label !== "BELİRSİZ" && (
              <div className={cn("rounded-full border px-2.5 py-0.5 font-semibold", regimeColor)} title={regime.description}>
                REJİM: {regime.label}
              </div>
            )}
            {data && (
              <span className="text-muted-foreground" title={data.sourceNote}>
                Son veri: {fmtTime(data.fetchedAt)}
              </span>
            )}
          </div>
        </div>

        {regime && regime.label === "BELİRSİZ" && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500">
            <AlertTriangle className="h-3 w-3" /> Gerçek zamanlı veri bağlantısı aktif değil — endeks verisi alınamadı, piyasa rejimi tespit edilemedi.
          </div>
        )}
      </div>
    </div>
  );
}

function IndexChip({ name, quote, strong, invert }: { name: string; quote: { price: number; changePercent: number }; strong?: boolean; invert?: boolean }) {
  const up = invert ? quote.changePercent < 0 : quote.changePercent >= 0;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{name}</span>
      <span className={cn("font-semibold tabular-nums", strong && "text-sm")}>{fmtNum(quote.price)}</span>
      <span className={cn("tabular-nums", up ? "text-emerald-500" : "text-red-500")}>{fmtPct(quote.changePercent)}</span>
    </div>
  );
}
