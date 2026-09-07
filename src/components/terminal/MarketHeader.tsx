"use client";

/** Kondanse üst piyasa durumu çubuğu — mobilde yatay scroll marquee */

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
      <div className="mx-auto max-w-[1500px] px-2.5 py-1.5 sm:px-5">
        {/* Mobil: compact tek satır */}
        <div className="flex items-center gap-2 sm:hidden">
          <div className="flex shrink-0 items-center gap-1 font-semibold text-xs">
            <Activity className="h-3 w-3 text-emerald-500" />
            BIST AI
          </div>

          <div className={cn("flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9px]", clock.open ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : "text-muted-foreground border-border bg-muted/40")}>
            <Clock className="h-2.5 w-2.5" />
            {clock.label}
          </div>

          {/* Marquee ticker */}
          <div className="flex-1 overflow-hidden">
            <div className="flex animate-[marquee_20s_linear_infinite] gap-4 whitespace-nowrap text-[10px]">
              {idx?.bist100 && <IndexChip name="BIST100" quote={idx.bist100} compact />}
              {idx?.usdtry && <IndexChip name="USD/TRY" quote={idx.usdtry} invert compact />}
              {idx?.gold && <IndexChip name="Altin" quote={idx.gold} compact />}
              {idx?.brent && <IndexChip name="Brent" quote={idx.brent} compact />}
              {/* Kopya — kesintisiz marquee için */}
              {idx?.bist100 && <IndexChip name="BIST100" quote={idx.bist100} compact />}
              {idx?.usdtry && <IndexChip name="USD/TRY" quote={idx.usdtry} invert compact />}
            </div>
          </div>

          {regime && regime.label !== "BELiRSiZ" && (
            <div className={cn("shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold", regimeColor)}>
              {regime.label}
            </div>
          )}
        </div>

        {/* Masaüstü: tam satır */}
        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:flex">
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            BIST AI Terminal
          </div>

          <div className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", clock.open ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : "text-muted-foreground border-border bg-muted/40")}>
            <Clock className="h-3 w-3" />
            {clock.label}
          </div>

          {isLoading && <span className="text-muted-foreground">Yukleniyor...</span>}

          {idx?.bist100 && <IndexChip name="BIST 100" quote={idx.bist100} strong />}
          {idx?.usdtry && <IndexChip name="Dolar/TL" quote={idx.usdtry} invert />}
          {idx?.gold && <IndexChip name="Altin (ons)" quote={idx.gold} />}
          {idx?.brent && <IndexChip name="Brent" quote={idx.brent} />}

          <div className="ms-auto flex items-center gap-2">
            {regime && regime.label !== "BELiRSiZ" && (
              <div className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", regimeColor)} title={regime.description}>
                REJiM: {regime.label}
              </div>
            )}
            {data && (
              <span className="text-muted-foreground" title={data.sourceNote}>
                Son: {fmtTime(data.fetchedAt)}
              </span>
            )}
          </div>
        </div>

        {regime && regime.label === "BELiRSiZ" && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500 sm:hidden md:flex">
            <AlertTriangle className="h-3 w-3" /> Gercek zamanli veri baglantisi aktif degil.
          </div>
        )}
      </div>
    </div>
  );
}

function IndexChip({ name, quote, strong, invert, compact }: { name: string; quote: { price: number; changePercent: number }; strong?: boolean; invert?: boolean; compact?: boolean }) {
  const up = invert ? quote.changePercent < 0 : quote.changePercent >= 0;
  return (
    <div className="flex items-baseline gap-1 shrink-0">
      <span className="text-muted-foreground">{name}</span>
      <span className={cn("font-semibold tabular-nums", strong && !compact && "text-xs")}>{fmtNum(quote.price)}</span>
      <span className={cn("tabular-nums", up ? "text-emerald-500" : "text-red-500")}>{fmtPct(quote.changePercent)}</span>
    </div>
  );
}
