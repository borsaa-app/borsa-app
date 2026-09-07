"use client";

/**
 * Portföy Store — Turso DB kalıcılığı (API üzerinden)
 * Pozisyonlar: hisse, adet, ortalama maliyet, giriş tarihi
 * Kâr/zarar hesapları gerçek zamanlı fiyatlama verisiyle yapılır.
 */

import { create } from "zustand";

export interface Position {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
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
  loaded: boolean;
  addPosition: (p: Omit<Position, "id" | "createdAt">) => { ok: boolean; error?: string };
  closePosition: (id: string, price: number, reason?: string) => void;
  removePosition: (id: string) => void;
  logAlert: (a: Omit<PortfolioAlertLog, "id" | "at" | "read">) => void;
  markAllRead: () => void;
  clearLog: () => void;
  loadFromServer: () => Promise<void>;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function apiGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function apiPost<T>(url: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function apiDelete(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiPut<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export const usePortfolio = create<PortfolioState>((set, get) => ({
  positions: [],
  trades: [],
  alertLog: [],
  loaded: false,

  loadFromServer: async () => {
    const [posRes, tradeRes, alertRes] = await Promise.all([
      apiGet<{ positions: Position[] }>("/api/portfolio/positions"),
      apiGet<{ trades: TradeRecord[] }>("/api/portfolio/trades"),
      apiGet<{ alerts: PortfolioAlertLog[] }>("/api/portfolio/alerts"),
    ]);
    set({
      positions: posRes?.positions ?? [],
      trades: tradeRes?.trades ?? [],
      alertLog: alertRes?.alerts ?? [],
      loaded: true,
    });
  },

  addPosition: (p) => {
    if (p.quantity <= 0) return { ok: false, error: "Adet 0'dan büyük olmalı." };
    if (p.avgCost <= 0) return { ok: false, error: "Ortalama maliyet 0'dan büyük olmalı." };
    const total = p.quantity * p.avgCost;
    if (total < 100)
      return {
        ok: false,
        error: `Minimum yatırım tutarı 100 TL'dir. Girdiğiniz pozisyon: ${total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL.`,
      };

    const existing = get().positions.find((x) => x.symbol === p.symbol.toUpperCase());
    const tradeId = genId();

    if (existing) {
      const newQty = existing.quantity + p.quantity;
      const newCost = (existing.quantity * existing.avgCost + p.quantity * p.avgCost) / newQty;
      const updatedPosition = { ...existing, quantity: newQty, avgCost: newCost };

      set({
        positions: get().positions.map((x) => (x.id === existing.id ? updatedPosition : x)),
        trades: [
          { id: tradeId, positionId: existing.id, symbol: p.symbol.toUpperCase(), action: "ALIM", quantity: p.quantity, price: p.avgCost, at: Date.now(), reason: p.notes },
          ...get().trades,
        ],
      });

      apiPut(`/api/portfolio/positions/${existing.id}`, { quantity: newQty, avgCost: newCost });
      apiPost("/api/portfolio/trades", { positionId: existing.id, symbol: p.symbol.toUpperCase(), action: "ALIM", quantity: p.quantity, price: p.avgCost, reason: p.notes });
    } else {
      const posId = genId();
      const newPos: Position = {
        ...p,
        symbol: p.symbol.toUpperCase(),
        id: posId,
        createdAt: Date.now(),
      };

      set({
        positions: [...get().positions, newPos],
        trades: [
          { id: tradeId, positionId: "", symbol: p.symbol.toUpperCase(), action: "ALIM", quantity: p.quantity, price: p.avgCost, at: Date.now(), reason: p.notes },
          ...get().trades,
        ],
      });

      apiPost("/api/portfolio/positions", { id: posId, symbol: p.symbol.toUpperCase(), name: p.name, quantity: p.quantity, avgCost: p.avgCost, notes: p.notes });
      apiPost("/api/portfolio/trades", { positionId: posId, symbol: p.symbol.toUpperCase(), action: "ALIM", quantity: p.quantity, price: p.avgCost, reason: p.notes });
    }

    return { ok: true };
  },

  closePosition: (id, price, reason) => {
    const pos = get().positions.find((x) => x.id === id);
    if (!pos) return;

    set({
      positions: get().positions.filter((x) => x.id !== id),
      trades: [
        { id: genId(), positionId: id, symbol: pos.symbol, action: "SATIM", quantity: pos.quantity, price, at: Date.now(), reason },
        ...get().trades,
      ],
    });

    apiDelete(`/api/portfolio/positions/${id}`);
    apiPost("/api/portfolio/trades", { positionId: id, symbol: pos.symbol, action: "SATIM", quantity: pos.quantity, price, reason });
  },

  removePosition: (id) => {
    set({ positions: get().positions.filter((x) => x.id !== id) });
    apiDelete(`/api/portfolio/positions/${id}`);
  },

  logAlert: (a) => {
    const entry: PortfolioAlertLog = { ...a, id: genId(), at: Date.now(), read: false };
    set({ alertLog: [entry, ...get().alertLog].slice(0, 100) });
    apiPost("/api/portfolio/alerts", a);
  },

  markAllRead: () => {
    set({ alertLog: get().alertLog.map((a) => ({ ...a, read: true })) });
    apiPost("/api/portfolio/alerts/read");
  },

  clearLog: () => {
    set({ alertLog: [] });
    apiDelete("/api/portfolio/alerts");
  },
}));
