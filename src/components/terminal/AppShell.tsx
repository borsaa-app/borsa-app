"use client"

/**
 * AppShell — Adaptif kabuk
 * Mobil: sabit üst app-bar + bottom tab bar (safe-area)
 * Desktop: sol collapsible sidebar + üst komut çubuğu
 */

import { useBreakpoint } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ListTree,
  PiggyBank,
  Newspaper,
  Settings,
  ArrowLeft,
} from "lucide-react"

export type View = "dashboard" | "scanner" | "portfolio" | "news" | "settings" | "stock"

const NAV_ITEMS: Array<{ key: Exclude<View, "stock">; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Terminal", icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: "scanner", label: "Firsatlar", icon: <ListTree className="h-4 w-4" /> },
  { key: "portfolio", label: "Portfoy", icon: <PiggyBank className="h-4 w-4" /> },
  { key: "news", label: "Haberler", icon: <Newspaper className="h-4 w-4" /> },
  { key: "settings", label: "Ayarlar", icon: <Settings className="h-4 w-4" /> },
]

export function AppShell({
  view,
  onNavigate,
  children,
  badge,
}: {
  view: View
  onNavigate: (v: View) => void
  children: React.ReactNode
  badge?: number
}) {
  const bp = useBreakpoint()
  const isMobile = bp === "mobile"
  const isTablet = bp === "tablet"

  if (isMobile || isTablet) {
    return (
      <MobileShell view={view} onNavigate={onNavigate} badge={badge}>
        {children}
      </MobileShell>
    )
  }

  return (
    <DesktopShell view={view} onNavigate={onNavigate} badge={badge}>
      {children}
    </DesktopShell>
  )
}

/* ── Mobil kabuk: bottom tab bar + safe area ── */
function MobileShell({
  view,
  onNavigate,
  children,
  badge,
}: {
  view: View
  onNavigate: (v: View) => void
  children: React.ReactNode
  badge?: number
}) {
  const activeTab = view === "stock" ? "dashboard" : view

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0e17]">
      {/* İçerik — bottom bar için padding */}
      <main className="flex-1 overflow-y-auto px-2.5 pb-20 pt-2">
        {children}
      </main>

      {/* Bottom tab bar — safe-area destekli */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#0d1322]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0d1322]/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              className={cn(
                "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] transition",
                activeTab === n.key
                  ? "text-emerald-400"
                  : "text-slate-500 active:text-slate-300"
              )}
            >
              {n.icon}
              <span>{n.label}</span>
              {n.key === "portfolio" && badge && badge > 0 ? (
                <span className="absolute -top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

/* ── Masaüstü kabuk: sol sidebar + üst bar ── */
function DesktopShell({
  view,
  onNavigate,
  children,
  badge,
}: {
  view: View
  onNavigate: (v: View) => void
  children: React.ReactNode
  badge?: number
}) {
  return (
    <div className="flex min-h-dvh bg-[#0a0e17]">
      {/* Sol sidebar */}
      <aside className="sticky top-0 flex h-dvh w-14 flex-col border-r border-white/5 bg-[#0d1322]/80 py-3 xl:w-48">
        {/* Logo */}
        <div className="mb-4 flex items-center gap-2 px-3 text-sm font-bold text-emerald-400">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="hidden xl:inline">BIST AI</span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition",
                view === n.key || (view === "stock" && n.key === "dashboard")
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              {n.icon}
              <span className="hidden xl:inline">{n.label}</span>
              {n.key === "portfolio" && badge && badge > 0 ? (
                <span className="ms-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </aside>

      {/* Ana içerik */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-3">
          {children}
        </main>
      </div>
    </div>
  )
}
