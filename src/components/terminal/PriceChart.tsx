"use client";

/**
 * SVG Mum Grafik + Hacim — bağımsız, hafif, terminal görünümü
 * Gerçek OHLCV verisiyle çalışır.
 */

import { useMemo, useState } from "react";

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  candles: ChartCandle[];
  height?: number;
  overlays?: Array<{ label: string; value: number | null; color: string }>;
  supportLevels?: number[];
  resistanceLevels?: number[];
}

export default function PriceChart({ candles, height = 320, overlays = [], supportLevels = [], resistanceLevels = [] }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const VH = 56; // hacim paneli
  const PH = H - VH - 26; // fiyat paneli
  const W = 760;

  const data = useMemo(() => candles.slice(-120), [candles]);

  const { min, max, maxVol } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    let mv = 0;
    for (const c of data) {
      lo = Math.min(lo, c.low);
      hi = Math.max(hi, c.high);
      mv = Math.max(mv, c.volume);
    }
    for (const lv of [...supportLevels, ...resistanceLevels]) {
      if (lv > lo * 0.95 && lv < hi * 1.05) {
        lo = Math.min(lo, lv);
        hi = Math.max(hi, lv);
      }
    }
    const pad = (hi - lo) * 0.06;
    return { min: lo - pad, max: hi + pad, maxVol: mv || 1 };
  }, [data, supportLevels, resistanceLevels]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>Grafik verisi yok.</div>;
  }

  const cw = W / data.length;
  const y = (p: number) => PH - ((p - min) / (max - min)) * PH + 8;
  const volY = (v: number) => H - 4 - (v / maxVol) * (VH - 8);

  const closeLine = data.map((c, i) => `${i === 0 ? "M" : "L"}${i * cw + cw / 2},${y(c.close)}`).join(" ");
  const hoverCandle = hover != null ? data[hover] : null;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        {/* Izgara */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={PH * f + 8} y2={PH * f + 8} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
        ))}

        {/* Destek/direnç seviyeleri */}
        {resistanceLevels.map((lv, i) =>
          lv > min && lv < max ? (
            <g key={`r${i}`}>
              <line x1={0} x2={W} y1={y(lv)} y2={y(lv)} stroke="#f87171" strokeOpacity={0.45} strokeDasharray="5 4" strokeWidth={1} />
              <text x={4} y={y(lv) - 3} fill="#f87171" fontSize={9} opacity={0.85}>R: {lv.toFixed(2)}</text>
            </g>
          ) : null
        )}
        {supportLevels.map((lv, i) =>
          lv > min && lv < max ? (
            <g key={`s${i}`}>
              <line x1={0} x2={W} y1={y(lv)} y2={y(lv)} stroke="#4ade80" strokeOpacity={0.45} strokeDasharray="5 4" strokeWidth={1} />
              <text x={4} y={y(lv) + 11} fill="#4ade80" fontSize={9} opacity={0.85}>D: {lv.toFixed(2)}</text>
            </g>
          ) : null
        )}

        {/* Mumlar */}
        {data.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? "#22c55e" : "#ef4444";
          const bw = Math.max(1.5, cw * 0.62);
          const bx = i * cw + (cw - bw) / 2;
          const top = y(Math.max(c.open, c.close));
          const bot = y(Math.min(c.open, c.close));
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={i * cw} y={0} width={cw} height={H} fill="transparent" />
              <line x1={i * cw + cw / 2} x2={i * cw + cw / 2} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
              <rect x={bx} y={top} width={bw} height={Math.max(1, bot - top)} fill={color} opacity={0.9} />
              <rect x={i * cw + (cw - bw) / 2} y={volY(c.volume)} width={bw} height={Math.max(0.5, H - 4 - volY(c.volume))} fill={color} opacity={0.35} />
            </g>
          );
        })}

        {/* Kapanış çizgisi */}
        <path d={closeLine} fill="none" stroke="#e5e7eb" strokeOpacity={0.5} strokeWidth={1.2} />

        {/* Hover */}
        {hover != null && (
          <line x1={hover * cw + cw / 2} x2={hover * cw + cw / 2} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
        )}
      </svg>

      {/* Hover bilgisi */}
      {hoverCandle && (
        <div className="absolute left-2 top-2 rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-lg">
          <span className="text-muted-foreground">{new Date(hoverCandle.time).toLocaleDateString("tr-TR")}</span>
          <span className="ml-2">A: {hoverCandle.open.toFixed(2)}</span>
          <span className="ml-1.5">Y: {hoverCandle.high.toFixed(2)}</span>
          <span className="ml-1.5">D: {hoverCandle.low.toFixed(2)}</span>
          <span className="ml-1.5">K: {hoverCandle.close.toFixed(2)}</span>
          <span className="ml-1.5 text-muted-foreground">Hacim: {hoverCandle.volume.toLocaleString("tr-TR")}</span>
        </div>
      )}

      {/* Overlay göstergeleri */}
      {overlays.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 px-2 text-[11px] text-muted-foreground">
          {overlays.map((o) => (
            <span key={o.label}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} /> {o.label}: {o.value != null ? o.value.toFixed(2) : "—"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
