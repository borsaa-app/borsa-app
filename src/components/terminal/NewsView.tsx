"use client";

/** Haberler — genel + hisse bazlı akış, duygu etiketli */

import { useNews } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Search } from "lucide-react";
import { useState } from "react";
import { BIST_UNIVERSE } from "@/lib/market/symbols";

export default function NewsView({ onSelectSymbol }: { onSelectSymbol: (s: string) => void }) {
  const [query, setQuery] = useState("");
  const resolved = query.trim().toUpperCase() || "";
  const isValidSymbol = resolved === "" || BIST_UNIVERSE.some((s) => s.symbol === resolved);
  const news = useNews(isValidSymbol ? resolved : "", 20);

  const agg = news.data;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Newspaper className="h-3.5 w-3.5 text-sky-500" /> HABERLER
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Hisse ara (THYAO, ASELS)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-7 h-8 text-[11px]"
              list="symbols-list"
            />
            <datalist id="symbols-list">
              {BIST_UNIVERSE.map((s) => (
                <option key={s.symbol} value={s.symbol} />
              ))}
            </datalist>
          </div>

          {agg && agg.items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <Badge variant="outline" className={cn("text-[9px]", agg.overallSentiment > 8 ? "text-emerald-500 border-emerald-500/30" : agg.overallSentiment < -8 ? "text-red-500 border-red-500/30" : "")}>
                Skor: {agg.overallSentiment > 0 ? "+" : ""}{agg.overallSentiment}
              </Badge>
              <span>{agg.items.length} haber · {agg.bullishCount} olumlu · {agg.bearishCount} olumsuz</span>
            </div>
          )}

          {news.isLoading ? (
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !agg || agg.items.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">Haber bulunamadi.</p>
          ) : (
            <div className="space-y-1">
              {agg.items.map((n, i) => {
                const symMatch = BIST_UNIVERSE.find((s) => n.title.toUpperCase().includes(s.symbol));
                return (
                  <div key={i} className="group rounded-lg border p-2 transition hover:bg-accent/50">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={cn("rounded px-1 py-px text-[9px] font-bold", n.sentimentLabel === "OLUMLU" ? "bg-emerald-500/15 text-emerald-500" : n.sentimentLabel === "OLUMSUZ" ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground")}>
                        {n.sentimentLabel}
                      </span>
                      {n.impact === "YÜKSEK" && <span className="rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold text-amber-500">YUKSEK</span>}
                      {symMatch && (
                        <button onClick={() => onSelectSymbol(symMatch.symbol)} className="rounded bg-sky-500/10 px-1 py-px text-[9px] font-bold text-sky-500 hover:bg-sky-500/20">
                          {symMatch.symbol}
                        </button>
                      )}
                      <span className="ms-auto text-[9px] text-muted-foreground">{n.source} · {timeAgo(n.publishedAt)}</span>
                    </div>
                    <a href={n.link} target="_blank" rel="noreferrer" className="mt-1 block text-[11px] font-medium leading-snug hover:underline line-clamp-1">
                      {n.title}
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
