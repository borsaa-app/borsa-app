"use client";

/**
 * Client-side API bağlayıcıları — React Query ile gerçek veri çekimi
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis } from "@/lib/analysis/engine";
import type { Quote } from "@/lib/market/providers";
import type { Regime } from "@/lib/analysis/support-resistance";
import type { MarketNewsResult } from "@/lib/market/news";

export interface MarketOverview {
  indices: {
    bist100: Quote | null;
    bist30: Quote | null;
    usdtry: Quote | null;
    eurtry: Quote | null;
    gold: Quote | null;
    brent: Quote | null;
  };
  regime: Regime;
  source: string;
  sourceNote: string;
  fetchedAt: number;
}

export interface ScanResponse {
  lists: {
    bestOpportunities: ScanRow[];
    strongestMomentum: ScanRow[];
    biggestLosers: ScanRow[];
    recoveryCandidates: ScanRow[];
    lowestRisk: ScanRow[];
    highRiskHighReward: ScanRow[];
    oversoldBounce: ScanRow[];
    nearResistance: ScanRow[];
  };
  regime: Regime;
  scanned: number;
  errors: string[];
  source: string;
  sourceNote: string;
  fetchedAt: number;
}

export interface ScanRow {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  score: number;
  reason: string;
  volumeRatio: number | null;
  rsi: number | null;
  from52High: number | null;
  support: number | null;
  resistance: number | null;
}

export interface HistoryResponse {
  symbol: string;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  meta: { currency: string; exchange: string; regularMarketPrice?: number; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number };
  source: string;
  sourceNote: string;
  fetchedAt: number;
}

export function useMarket(refreshMs = 60_000) {
  return useQuery<MarketOverview>({
    queryKey: ["market"],
    queryFn: async () => {
      const res = await fetch("/api/market");
      if (!res.ok) throw new Error("Piyasa verisi alınamadı");
      return res.json();
    },
    refetchInterval: refreshMs,
    staleTime: 30_000,
  });
}

export function useQuotes(symbols: string[], refreshMs = 60_000) {
  const key = symbols.join(",");
  return useQuery<{ quotes: Record<string, Quote>; source: string; sourceNote: string; fetchedAt: number }>({
    queryKey: ["quotes", key],
    queryFn: async () => {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error("Fiyat verisi alınamadı");
      return res.json();
    },
    enabled: symbols.length > 0,
    refetchInterval: refreshMs,
    staleTime: 25_000,
  });
}

export function useAnalysis(symbol: string | null) {
  return useQuery<{ analysis: Analysis; fetchedAt: number }>({
    queryKey: ["analysis", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/analysis?symbol=${symbol}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Analiz alınamadı");
      }
      return res.json();
    },
    enabled: Boolean(symbol),
    staleTime: 120_000,
  });
}

export function useHistory(symbol: string | null, range = "6mo") {
  return useQuery<HistoryResponse>({
    queryKey: ["history", symbol, range],
    queryFn: async () => {
      const res = await fetch(`/api/history?symbol=${symbol}&range=${range}&interval=1d`);
      if (!res.ok) throw new Error("Grafik verisi alınamadı");
      return res.json();
    },
    enabled: Boolean(symbol),
    staleTime: 300_000,
  });
}

export interface DailyPicksResponse {
  generatedAt: number;
  marketStatus: {
    open: boolean;
    session: string;
    nextEvent: string;
  };
  picks: Array<{
    symbol: string;
    name: string;
    sector: string;
    price: number;
    changePercent: number;
    direction: string;
    todayTarget: number;
    todayTargetHigh: number;
    todayTargetPct: number;
    todayTargetHighPct: number;
    weekTarget: number;
    weekTargetPct: number;
    entryLow: number;
    entryHigh: number;
    stopLoss: number;
    riskReward: number;
    confidence: number;
    profitPer100: number;
    profitPer100High: number;
    reason: string;
    invalidation: string;
    rsi: number | null;
    volumeRatio: number | null;
    perfWeek: number | null;
    distanceResistancePct: number | null;
  }>;
  avoid: Array<{ symbol: string; name: string; price: number; changePercent: number; reason: string }>;
  regime: {
    type: string;
    label: string;
    description: string;
    bist100Change: number;
    bist100Trend: string;
    volatilityLevel: string;
    momentumScore: number;
    advice: string;
  };
  headline: string;
  sourceNote: string;
  disclaimer: string;
}

/** Ajanın bugünkü seçimleri — "bugün ne alsam, hedefi kaç TL" sorusuna net cevap */
export function usePicks(refreshMs = 3 * 60_000) {
  return useQuery<DailyPicksResponse>({
    queryKey: ["picks"],
    queryFn: async () => {
      const res = await fetch("/api/picks");
      if (!res.ok) throw new Error("Günlük seçimler alınamadı");
      return res.json();
    },
    refetchInterval: refreshMs,
    staleTime: 2 * 60_000,
  });
}


export function useNews(symbol: string | null, limit = 12) {
  return useQuery<MarketNewsResult & { source: string; fetchedAt: number }>({
    queryKey: ["news", symbol, limit],
    queryFn: async () => {
      const url = symbol ? `/api/news?symbol=${symbol}&limit=${limit}` : `/api/news?limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Haberler alınamadı");
      return res.json();
    },
    enabled: symbol !== undefined,
    staleTime: 300_000,
  });
}

export function useScan(enabled = true) {
  return useQuery<ScanResponse>({
    queryKey: ["scan"],
    queryFn: async () => {
      const res = await fetch("/api/scan");
      if (!res.ok) throw new Error("Tarama yapılamadı");
      return res.json();
    },
    enabled,
    staleTime: 180_000,
    refetchInterval: 300_000,
  });
}

/** Piyasa saati kontrolü: hafta içi 10:00-18:00 TRT */
export function useMarketClock() {
  const [state, setState] = useState({ open: false, label: "" });
  const ref = useRef(0);
  const check = useCallback(() => {
    const now = new Date();
    // TRT = UTC+3
    const trt = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    const day = trt.getDay();
    const mins = trt.getHours() * 60 + trt.getMinutes();
    const open = day >= 1 && day <= 5 && mins >= 600 && mins < 1080;
    setState({
      open,
      label: open ? "PİYASA AÇIK" : day === 0 || day === 6 ? "HAFTA SONU — PİYASA KAPALI" : "PİYASA KAPALI",
    });
  }, []);
  useEffect(() => {
    const t = setTimeout(check, 0);
    const iv = setInterval(check, 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [check]);
  return state;
}

export function useRefreshToken(ms: number) {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setTick((t) => t + 1);
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["market"] });
    }, ms);
    return () => clearInterval(iv);
  }, [ms, qc]);
  return tick;
}
