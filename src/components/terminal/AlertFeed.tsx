"use client";

/** Sağ panel — canlı uyarı akışı + ajan kararları */

import { usePortfolio } from "@/lib/store/portfolio";
import { timeAgo } from "@/lib/format";
import { BellRing, Info, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export default function AlertFeed({ onSelectSymbol }: { onSelectSymbol: (s: string) => void }) {
  const { alertLog, markAllRead, clearLog } = usePortfolio();
  const unread = useMemo(() => alertLog.filter((a) => !a.read).length, [alertLog]);

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <BellRing className="h-4 w-4 text-amber-500" />
          Canlı Uyarılar
          {unread > 0 && <span className="ml-1 rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">{unread}</span>}
        </div>
        {alertLog.length > 0 && (
          <button onClick={clearLog} className="text-[11px] text-muted-foreground hover:text-foreground" title="Tümünü temizle">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-[280px] min-h-[120px] flex-1 space-y-1.5 overflow-y-auto p-2 terminal-scroll lg:max-h-[420px]">
        {alertLog.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center text-xs text-muted-foreground">
            <ShieldAlert className="h-5 w-5 opacity-40" />
            Henüz uyarı yok. Portföy pozisyonu eklediğinizde; düşüş, kâr hedefi, stop ve haber uyarıları burada canlı olarak görünür.
          </div>
        ) : (
          alertLog.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                markAllRead();
                if (a.symbol) onSelectSymbol(a.symbol);
              }}
              className={cn(
                "block w-full rounded-md border p-2 text-start text-xs transition hover:bg-accent",
                a.read ? "border-border opacity-70" : "border-amber-500/30 bg-amber-500/5"
              )}
            >
              <div className="flex items-center gap-1.5">
                {a.type === "DROP" || a.type === "STOP_BREACH" ? (
                  <TriangleAlert className="h-3 w-3 shrink-0 text-red-500" />
                ) : a.type === "TARGET" || a.type === "RISE" ? (
                  <Info className="h-3 w-3 shrink-0 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-3 w-3 shrink-0 text-amber-500" />
                )}
                <span className="font-semibold">{a.symbol}</span>
                <span className="ms-auto text-[10px] text-muted-foreground">{timeAgo(a.at)}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-muted-foreground">{a.message}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
