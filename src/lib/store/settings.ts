"use client";

/**
 * Ayarlar Store — bildirim eşikleri, e-posta, tarama aralığı
 * localStorage kalıcılığı ile.
 */

import { create } from "zustand";

export interface Settings {
  dropAlertPct: number; // default -5
  riseAlertPct: number; // default +5
  targetAlertPct: number; // hedef 1 ulaşınca
  cooldownMinutes: number; // aynı uyarı tekrarı arası dk
  pollingSeconds: number; // fiyatlama tarama aralığı
  emailTo: string; // bildirim e-postası
  emailEnabled: boolean; // e-posta bildirimi açık mı
  browserNotify: boolean; // tarayıcı bildirimi
  soundNotify: boolean;
  minInvestment: number; // 100 TL
}

interface SettingsState extends Settings {
  update: (s: Partial<Settings>) => void;
}

const DEFAULTS: Settings = {
  dropAlertPct: 5,
  riseAlertPct: 5,
  targetAlertPct: 10,
  cooldownMinutes: 30,
  pollingSeconds: 60,
  emailTo: "",
  emailEnabled: false,
  browserNotify: true,
  soundNotify: false,
  minInvestment: 100,
};

const LS_KEY = "bist-ai-terminal-settings-v1";

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  update: (s) => {
    set(s as SettingsState);
    if (typeof window !== "undefined") {
      try {
        const { update: _u, ...rest } = get();
        window.localStorage.setItem(LS_KEY, JSON.stringify(rest));
      } catch {
        // yut
      }
    }
  },
}));
