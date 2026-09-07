"use client";

/** Sayı ve metin biçimlendirme yardımcıları (tr-TR) */

export function fmtNum(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "—";
  return x.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtTL(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "— TL";
  return `${x.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} TL`;
}

export function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${x > 0 ? "+" : ""}${x.toFixed(digits)}%`;
}

export function fmtPctNL(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${x.toFixed(digits)}%`;
}

export function fmtVol(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Mr`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mn`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} B`;
  return v.toFixed(0);
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}
