"use client"

import { cn } from "@/lib/utils"

/* ── StatBox: tek tip kutu bileşeni (Stat, TotalBox, MiniStat, MetricBox yerine) ── */
export function StatBox({
  label,
  value,
  tone,
  sub,
  size = "md",
  className,
}: {
  label: string
  value: string
  tone?: "up" | "down" | "neutral"
  sub?: string
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 tabular-nums",
        size === "sm" ? "p-2" : "p-2.5",
        className
      )}
    >
      <div className={cn(
        "text-muted-foreground",
        size === "sm" ? "text-[9px]" : "text-[10px]"
      )}>
        {label}
      </div>
      <div className={cn(
        "font-semibold",
        size === "sm" ? "text-xs" : "text-sm",
        tone === "up" && "text-emerald-400",
        tone === "down" && "text-red-400",
        !tone && "text-foreground"
      )}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  )
}

/* ── SectionCard: başlıklı bölüm kartı ── */
export function SectionCard({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <h3 className="text-[11px] font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

/* ── RowButton: satır tıklama但onu ── */
export function RowButton({
  children,
  onClick,
  active,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50 min-h-[44px]",
        active && "bg-muted/70",
        className
      )}
    >
      {children}
    </button>
  )
}

/* ── Pill: filtre çipi / etiket ── */
export function Pill({
  children,
  active,
  onClick,
  className,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors min-h-[28px]",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:bg-muted/50",
        className
      )}
    >
      {children}
    </button>
  )
}
