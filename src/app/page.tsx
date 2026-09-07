"use client";

/**
 * BIST AI Yatırım Terminali — Ana sayfa (SPA)
 * Görünümler: Dashboard / Tarayıcı / Portföy / Haberler / Ayarlar / Hisse Raporu
 * Canlı uyarı motoru arka planda çalışır (cooldown'lu).
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
import { useQuotes, useMarketClock } from "@/lib/api-client";
import { usePortfolio } from "@/lib/store/portfolio";
import { useSettings } from "@/lib/store/settings";
import { evaluateAlerts, type AlertEvent } from "@/lib/alerts/engine";
import { cn } from "@/lib/utils";
import { BarChart3, LayoutDashboard, LineChart, ListTree, Newspaper, PiggyBank, Settings } from "lucide-react";

type View = "dashboard" | "scanner" | "portfolio" | "news" | "settings" | "stock";

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("THYAO");
  const [liveEvents, setLiveEvents] = useState<AlertEvent[]>([]);
  const lastEvalRef = useRef<number>(0);

  const positions = usePortfolio((s) => s.positions);
  const loadPortfolio = usePortfolio((s) => s.loadFromServer);
  const settings = useSettings();
  const loadSettings = useSettings((s) => s.loadFromServer);
  const clock = useMarketClock();

  // DB'den başlangıç verilerini yükle
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

  const navigate = useCallback((v: "portfolio" | "scanner" | "news" | "settings") => setView(v), []);

  // Canlı uyarı motoru — fiyatlama geldiğinde eşikleri değerlendir
  useEffect(() => {
    const q = quotes.data?.quotes;
    if (!q || positions.length === 0) return;
    // En fazla 60 sn'de bir değerlendir
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

  const navItems: Array<{ key: View; label: string; icon: React.ReactNode; badge?: number }> = [
    { key: "dashboard", label: "Terminal", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "scanner", label: "Fırsatlar", icon: <ListTree className="h-4 w-4" /> },
    { key: "portfolio", label: "Portföy", icon: <PiggyBank className="h-4 w-4" />, badge: positions.length || undefined },
    { key: "news", label: "Haberler", icon: <Newspaper className="h-4 w-4" /> },
    { key: "settings", label: "Ayarlar", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] text-slate-200 terminal-bg">
      <MarketHeader />

      {/* Navigasyon */}
      <nav className="border-b border-white/5 bg-[#0d1322]/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-3 sm:px-5">
          {navItems.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition",
                view === n.key || (view === "stock" && n.key === "dashboard")
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              {n.icon}
              {n.label}
              {n.badge && <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-400">{n.badge}</span>}
            </button>
          ))}
          <div className="ms-auto hidden shrink-0 items-center gap-3 py-2.5 text-[11px] text-slate-500 md:flex">
            <span className="flex items-center gap-1">
              <span className={cn("inline-block h-1.5 w-1.5 animate-pulse rounded-full", quotes.isFetching ? "bg-emerald-500" : clock.open ? "bg-emerald-500/60" : "bg-slate-600")} />
              {quotes.isFetching ? "Veri akışı aktif" : clock.open ? "Canlı izleme açık" : "İzleme açık (piyasa kapalı)"}
            </span>
          </div>
        </div>
      </nav>

      {/* İçerik */}
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-4 sm:px-5">
        {view === "dashboard" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <Dashboard onSelectSymbol={openStock} onNavigate={navigate} />
            <div className="space-y-4">
              <AlertFeed onSelectSymbol={openStock} />
              {liveEvents.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="mb-1.5 text-xs font-bold text-amber-500">BU OTURUMDAKİ SON UYARILAR</div>
                  <div className="space-y-1.5">
                    {liveEvents.slice(0, 4).map((e, i) => (
                      <button key={i} onClick={() => openStock(e.symbol)} className="block w-full rounded-md bg-background/60 p-2 text-start text-[11px] hover:bg-accent">
                        <span className={cn("font-bold", e.severity === "critical" ? "text-red-500" : e.severity === "warning" ? "text-amber-500" : "text-emerald-500")}>
                          {e.title}
                        </span>
                        <p className="mt-0.5 line-clamp-2 text-slate-400">{e.message}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <QuickGuide onNavigate={navigate} />
            </div>
          </div>
        )}
        {view === "stock" && <StockDetail symbol={selectedSymbol} onBack={() => setView("dashboard")} />}
        {view === "scanner" && <ScannerView onSelectSymbol={openStock} />}
        {view === "portfolio" && <PortfolioView onSelectSymbol={openStock} />}
        {view === "news" && <NewsView onSelectSymbol={openStock} />}
        {view === "settings" && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#0d1322]">
        <div className="mx-auto max-w-[1500px] px-5 py-3 text-[11px] leading-relaxed text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              BIST AI Yatırım Terminali — hisse fiyatları: resmî BIST borsa verisi (Midas&apos;ta görüntülenenle aynı); endeks/döviz: Yahoo Finance. Midas kurumsal API anahtarı tanımlandığında otomatik devreye girer.
            </span>
            <span className="shrink-0">
              Analizler olasılık ve senaryo bazlıdır; yatırım tavsiyesi değildir.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function QuickGuide({ onNavigate }: { onNavigate: (v: "portfolio" | "scanner" | "news" | "settings") => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1322] p-3 text-xs">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-bold text-slate-300">NASIL KULLANILIR?</span>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
      </div>
      <ol className="space-y-1.5 text-slate-400">
        <li><span className="font-semibold text-slate-300">1.</span> <button className="text-emerald-400 underline-offset-2 hover:underline" onClick={() => onNavigate("portfolio")}>Portföy</button> sekmesinden hisse, adet ve maliyet girerek pozisyon açın (min 100 TL).</li>
        <li><span className="font-semibold text-slate-300">2.</span> Sistem pozisyonunuzu canlı izler: günlük/haftalık kâr-zarar, trailing stop, stop bölgesi.</li>
        <li><span className="font-semibold text-slate-300">3.</span> <button className="text-emerald-400 underline-offset-2 hover:underline" onClick={() => onNavigate("settings")}>Ayarlar</button>&apos;dan bildirim izni verin; -%5 düşüş, +%10 kâr hedefi ve stop uyarıları anında gelir.</li>
        <li><span className="font-semibold text-slate-300">4.</span> Zarar başladığında sistem önce <em>neden</em> analiz eder: piyasa geneli mi, hisseye özel mi, haber var mı?</li>
        <li><span className="font-semibold text-slate-300">5.</span> Kâr hedefinde momentum kontrolü yapılır: trend güçlüyse kademeli realizasyon önerilir.</li>
      </ol>
    </div>
  );
}
