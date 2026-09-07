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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Newspaper className="h-4 w-4 text-sky-500" /> HABER AKIŞI &amp; DUYGU ANALİZİ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hisse sembolü ara (örn. THYAO, ASELS)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              list="symbols-list"
            />
            <datalist id="symbols-list">
              {BIST_UNIVERSE.map((s) => (
                <option key={s.symbol} value={s.symbol} />
              ))}
            </datalist>
          </div>
          {query.trim() !== "" && !isValidSymbol && (
            <p className="text-xs text-amber-500">&quot;{query}&quot; Midas/BIST evreninde bulunamadı. Genel piyasa haberleri gösteriliyor.</p>
          )}

          {agg && agg.items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className={agg.overallSentiment > 8 ? "text-emerald-500 border-emerald-500/30" : agg.overallSentiment < -8 ? "text-red-500 border-red-500/30" : ""}>
                Akış skoru: {agg.overallSentiment > 0 ? "+" : ""}{agg.overallSentiment}
              </Badge>
              <span>{agg.items.length} haber · {agg.bullishCount} olumlu · {agg.bearishCount} olumsuz · {agg.neutralCount} nötr · {agg.highImpactCount} yüksek etkili</span>
              <span className="text-[10px]">Kaynak: Google Haberler (RSS) — {agg.source}</span>
            </div>
          )}
          {agg && agg.items.length > 0 && <p className="text-xs text-muted-foreground">{agg.summary}</p>}

          {news.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !agg || agg.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Güncel haber bulunamadı. Haber bulunamadığı durumda uydurma haber gösterilmez.
            </p>
          ) : (
            <div className="space-y-2">
              {agg.items.map((n, i) => {
                // Başlıktaki sembolü yakala
                const symMatch = BIST_UNIVERSE.find((s) => n.title.toUpperCase().includes(s.symbol));
                return (
                  <div key={i} className="group rounded-lg border p-3 transition hover:bg-accent/50">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", n.sentimentLabel === "OLUMLU" ? "bg-emerald-500/15 text-emerald-500" : n.sentimentLabel === "OLUMSUZ" ? "bg-red-500/15 text-red-500" : "bg-muted text-muted-foreground")}>
                        {n.sentimentLabel} ({n.sentiment > 0 ? "+" : ""}{n.sentiment})
                      </span>
                      {n.impact === "YÜKSEK" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">YÜKSEK ETKİ</span>}
                      {symMatch && (
                        <button onClick={() => onSelectSymbol(symMatch.symbol)} className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-500 hover:bg-sky-500/20">
                          {symMatch.symbol} → rapor
                        </button>
                      )}
                      <span className="ms-auto text-[10px] text-muted-foreground">{n.source} · {timeAgo(n.publishedAt)}</span>
                    </div>
                    <a href={n.link} target="_blank" rel="noreferrer" className="mt-1.5 block text-sm font-medium leading-snug hover:underline">
                      {n.title}
                    </a>
                    {n.matchedKeywords.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Tespit edilen sinyaller: {n.matchedKeywords.join(", ")}</p>
                    )}
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
