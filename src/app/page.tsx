"use client";

/**
 * BIST AI Yatirim Terminali — Ana sayfa (SPA)
 * Gorunumler: Dashboard / Tarayici / Portfoy / Haberler / Ayarlar / Hisse Raporu
 * Canli uyari motoru arka planda calisir (cooldown'lu).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import MarketHeader from "@/components/terminal/MarketHeader";
import Dashboard from "@/components/terminal/Dashboard";
import StockDetail from "@/components/terminal/StockDetail";
import PortfolioView from "@/components/terminal/PortfolioView";
import ScannerView from "@/components/terminal/ScannerView";
import NewsView from "@/components/terminal/NewsView";
import SettingsView from "@/components/terminal/SettingsView";
import AlertFeed from "@/components/terminal/AlertFeed";
import { AppShell, type View } from "@/components/terminal/AppShell";
import { useQuotes, useMarketClock } from "@/lib/api-client";
import { usePortfolio } from "@/lib/store/portfolio";
import { useSettings } from "@/lib/store/settings";
import { evaluateAlerts, type AlertEvent } from "@/lib/alerts/engine";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-mobile";

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("THYAO");
  const [liveEvents, setLiveEvents] = useState<AlertEvent[]>([]);
  const lastEvalRef = useRef<number>(0);
  const bp = useBreakpoint();

  const positions = usePortfolio((s) => s.positions);
  const loadPortfolio = usePortfolio((s) => s.loadFromServer);
  const settings = useSettings();
  const loadSettings = useSettings((s) => s.loadFromServer);
  const clock = useMarketClock();

  useEffect(() => {
    loadPortfolio();
    loadSettings();
  }, [loadPortfolio, loadSettings]);

  const symbols = positions.map((p) => p.symbol);
  const quotes = useQuotes(symbols, Math.max(30, settings.pollingSeconds) * 1000);

  const openStock = useCallback((s: string) => {
    setSelectedSymbol(s.toUpperCase().replace(".IS", ""));
    setView("stock");
  }, []);

  const navigate = useCallback((v: View) => setView(v), []);

  // Canli uyari motoru
  useEffect(() => {
    const q = quotes.data?.quotes;
    if (!q || positions.length === 0) return;
    if (Date.now() - lastEvalRef.current < 60_000) return;
    lastEvalRef.current = Date.now();

    const t = setTimeout(() => {
      const snapshots = positions
        .map((p) => {
          const quote = q[p.symbol];
          if (!quote) return null;
          return {
            symbol: p.symbol,
            quantity: p.quantity,
            avgCost: p.avgCost,
            price: quote.price,
            changePercent: quote.changePercent,
            changePctFromCost: ((quote.price - p.avgCost) / p.avgCost) * 100,
            dailyPL: p.quantity * quote.change,
            weeklyPL: 0,
            totalPL: p.quantity * (quote.price - p.avgCost),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const events = evaluateAlerts(snapshots);
      if (events.length > 0) {
        setLiveEvents((prev) => [...events, ...prev].slice(0, 20));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [quotes.data, positions]);

  const isDesktop = bp === "desktop";

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0e17] text-slate-200 terminal-bg">
      <MarketHeader />

      <AppShell view={view} onNavigate={navigate} badge={positions.length || undefined}>
        {view === "dashboard" && (
          <div className={cn("gap-3", isDesktop ? "grid xl:grid-cols-[1fr_280px]" : "")}>
            <Dashboard onSelectSymbol={openStock} onNavigate={navigate} />
            {isDesktop && (
              <div className="space-y-3">
                <AlertFeed onSelectSymbol={openStock} />
                {liveEvents.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
                    <div className="mb-1 text-[10px] font-bold text-amber-500">SON UYARILAR</div>
                    <div className="space-y-1">
                      {liveEvents.slice(0, 3).map((e, i) => (
                        <button key={i} onClick={() => openStock(e.symbol)} className="block w-full rounded-md bg-background/60 p-1.5 text-start text-[10px] hover:bg-accent">
                          <span className={cn("font-bold", e.severity === "critical" ? "text-red-500" : e.severity === "warning" ? "text-amber-500" : "text-emerald-500")}>
                            {e.title}
                          </span>
                          <p className="mt-0.5 line-clamp-1 text-slate-400">{e.message}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <QuickGuide onNavigate={navigate} />
              </div>
            )}
          </div>
        )}
        {view === "stock" && <StockDetail symbol={selectedSymbol} onBack={() => setView("dashboard")} />}
        {view === "scanner" && <ScannerView onSelectSymbol={openStock} />}
        {view === "portfolio" && <PortfolioView onSelectSymbol={openStock} />}
        {view === "news" && <NewsView onSelectSymbol={openStock} />}
        {view === "settings" && <SettingsView />}
      </AppShell>

      {/* Footer — masaüstünde görünür, mobilde gizli */}
      <footer className="mt-auto hidden border-t border-white/5 bg-[#0d1322] sm:block">
        <div className="mx-auto max-w-[1500px] px-5 py-2.5 text-[10px] leading-relaxed text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              BIST AI Yatirim Terminali — hisse fiyatlari: resmi BIST borsa verisi (Midas&apos;ta goruntulenenle ayni); endeks/doviz: Yahoo Finance.
            </span>
            <span className="shrink-0">
              Analizler olasilik ve senaryo bazlidir; yatirim tavsiyesi degildir.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function QuickGuide({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1322] p-2.5 text-[10px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold text-slate-300">NASIL KULLANILIR?</span>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">x</button>
      </div>
      <ol className="space-y-1 text-slate-400">
        <li><span className="font-semibold text-slate-300">1.</span> <button className="text-emerald-400 underline-offset-2 hover:underline" onClick={() => onNavigate("portfolio")}>Portfoy</button> sekmesinden hisse, adet ve maliyet girerek pozisyon acin.</li>
        <li><span className="font-semibold text-slate-300">2.</span> Sistem pozisyonunuzu canli izler: gunluk/haftalik kar-zarar, trailing stop.</li>
        <li><span className="font-semibold text-slate-300">3.</span> <button className="text-emerald-400 underline-offset-2 hover:underline" onClick={() => onNavigate("settings")}>Ayarlar</button>&apos;dan bildirim izni verin.</li>
      </ol>
    </div>
  );
}
