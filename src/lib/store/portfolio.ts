"use client";

/**
 * Portföy Store — localStorage kalıcılığı
 * Pozisyonlar: hisse, adet, ortalama maliyet, giriş tarihi
 * Kâr/zarar hesapları gerçek zamanlı fiyatlama verisiyle yapılır.
 */

import { create } from "zustand";

export interface Position {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number; // TL
  createdAt: number;
  notes?: string;
}

export interface TradeRecord {
  id: string;
  positionId: string;
  symbol: string;
  action: "ALIM" | "SATIM";
  quantity: number;
  price: number;
  at: number;
  reason?: string;
}

export interface PortfolioAlertLog {
  id: string;
  symbol: string;
  type: string;
  message: string;
  at: number;
  read: boolean;
}

interface PortfolioState {
  positions: Position[];
  trades: TradeRecord[];
  alertLog: PortfolioAlertLog[];
  addPosition: (p: Omit<Position, "id" | "createdAt">) => { ok: boolean; error?: string };
  closePosition: (id: string, price: number, reason?: string) => void;
  removePosition: (id: string) => void;
  logAlert: (a: Omit<PortfolioAlertLog, "id" | "at" | "read">) => void;
  markAllRead: () => void;
  clearLog: () => void;
}

const LS_KEY = "bist-ai-terminal-portfolio-v1";

function loadFromStorage(): { positions: Position[]; trades: TradeRecord[]; alertLog: PortfolioAlertLog[] } {
  if (typeof window === "undefined") return { positions: [], trades: [], alertLog: [] };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { positions: [], trades: [], alertLog: [] };
    const parsed = JSON.parse(raw) as { positions: Position[]; trades: TradeRecord[]; alertLog: PortfolioAlertLog[] };
    return {
      positions: parsed.positions ?? [],
      trades: parsed.trades ?? [],
      alertLog: parsed.alertLog ?? [],
    };
  } catch {
    return { positions: [], trades: [], alertLog: [] };
  }
}

function persist(state: PortfolioState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({ positions: state.positions, trades: state.trades, alertLog: state.alertLog.slice(0, 100) })
    );
  } catch {
    // storage dolu/kapalı — sessizce yut
  }
}

export const usePortfolio = create<PortfolioState>((set, get) => ({
  ...loadFromStorage(),
  addPosition: (p) => {
    if (p.quantity <= 0) return { ok: false, error: "Adet 0'dan büyük olmalı." };
    if (p.avgCost <= 0) return { ok: false, error: "Ortalama maliyet 0'dan büyük olmalı." };
    const total = p.quantity * p.avgCost;
    if (total < 100) return { ok: false, error: `Minimum yatırım tutarı 100 TL'dir. Girdiğiniz pozisyon: ${total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL.` };
    // Aynı sembol varsa maliyet ortalaması ve adet güncellenir
    const existing = get().positions.find((x) => x.symbol === p.symbol.toUpperCase());
    let positions: Position[];
    const trades: TradeRecord[] = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        positionId: existing?.id ?? "",
        symbol: p.symbol.toUpperCase(),
        action: "ALIM",
        quantity: p.quantity,
        price: p.avgCost,
        at: Date.now(),
        reason: p.notes,
      },
      ...get().trades,
    ];
    if (existing) {
      const newQty = existing.quantity + p.quantity;
      const newCost = (existing.quantity * existing.avgCost + p.quantity * p.avgCost) / newQty;
      positions = get().positions.map((x) => (x.id === existing.id ? { ...x, quantity: newQty, avgCost: newCost } : x));
    } else {
      positions = [
        ...get().positions,
        { ...p, symbol: p.symbol.toUpperCase(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
      ];
    }
    set({ positions, trades });
    persist(get());
    return { ok: true };
  },
  closePosition: (id, price, reason) => {
    const pos = get().positions.find((x) => x.id === id);
    if (!pos) return;
    set({
      positions: get().positions.filter((x) => x.id !== id),
      trades: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          positionId: id,
          symbol: pos.symbol,
          action: "SATIM",
          quantity: pos.quantity,
          price,
          at: Date.now(),
          reason,
        },
        ...get().trades,
      ],
    });
    persist(get());
  },
  removePosition: (id) => {
    set({ positions: get().positions.filter((x) => x.id !== id) });
    persist(get());
  },
  logAlert: (a) => {
    set({
      alertLog: [{ ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), read: false }, ...get().alertLog].slice(0, 100),
    });
    persist(get());
  },
  markAllRead: () => {
    set({ alertLog: get().alertLog.map((a) => ({ ...a, read: true })) });
    persist(get());
  },
  clearLog: () => {
    set({ alertLog: [] });
    persist(get());
  },
}));
