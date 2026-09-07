"use client";

/**
 * Ayarlar Store — bildirim eşikleri, e-posta, tarama aralığı
 * Turso DB kalıcılığı (API üzerinden).
 */

import { create } from "zustand";

export interface Settings {
  dropAlertPct: number;
  riseAlertPct: number;
  targetAlertPct: number;
  cooldownMinutes: number;
  pollingSeconds: number;
  emailTo: string;
  emailEnabled: boolean;
  browserNotify: boolean;
  soundNotify: boolean;
  minInvestment: number;
}

interface SettingsState extends Settings {
  loaded: boolean;
  update: (s: Partial<Settings>) => void;
  loadFromServer: () => Promise<void>;
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

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  loadFromServer: async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        set({ ...DEFAULTS, ...data, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  update: (s) => {
    set(s as SettingsState);
    const { loaded: _l, update: _u, ...rest } = get();
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    }).catch(() => {});
  },
}));
