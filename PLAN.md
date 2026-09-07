# BIST AI Terminali — UI Modernizasyon Planı

Kompakt UI + kapsamlı responsive (mobil-app / masaüstü-app) + PWA desteği.

## 1. Mevcut Mimari

- **Stack:** Next 16 (App Router, `output: standalone`), React 19, Tailwind v4 (CSS-first, `@theme inline`), shadcn/ui (new-york), Radix, React Query, Zustand, özel SVG `PriceChart`, Drizzle + Turso, Caddy reverse-proxy.
- **Tek rota:** `/` → SPA. Görünümler state ile: `dashboard | scanner | portfolio | news | settings | stock`.
- **Tema:** sabit koyu (`html.dark`, `#0a0e17`), `terminal-bg` overlay.

## 2. Sayfa & Bileşen Envanteri

**Kabuk (shell):** `layout.tsx` → `page.tsx` (nav + main + footer) → `MarketHeader` (ticker), `AlertFeed` (sağ rail), `QuickGuide`.

| Görünüm | Bileşenler | Alt-bileşenler |
|---|---|---|
| Terminal | `Dashboard` | `Stat`, `OpportunityRow`, `MiniList` |
| | `TodayPicks` | `PickCard`, `MiniStat` |
| Hisse | `StockDetail` | `IndicatorRow`, `PlanBox`, `MetricBox`, `PriceChart`, Dialog, Tabs |
| Fırsatlar | `ScannerView` | liste çipleri + satırlar |
| Portföy | `PortfolioView` | `PositionCard`, `TotalBox`, `MiniStat`, ekleme formu, bildirim bandı |
| Haberler | `NewsView` | arama + haber kartları |
| Ayarlar | `SettingsView` | `NumberField` + 6 bölüm |

**Kullanılan shadcn primitiveleri (12):** button, card, input, label, badge, skeleton, select, switch, separator, dialog, tabs, toast/toaster.

**Kullanılmayan (32 dosya) — temizlik adayı:** accordion, alert, alert-dialog, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, sidebar, slider, sonner, table, textarea, toggle, toggle-group, tooltip.

## 3. Tespit Edilen Sorunlar

### Kompaktlık
- `Card` tabanı `py-6 px-6 gap-6` (çok gevşek); her yer `space-y-4 / gap-4 / p-3-4`.
- Stat/kutu bileşenleri (`Stat`, `TotalBox`, `MiniStat`, `PlanBox`, `MetricBox`) 5 ayrı yerde tekrarlanmış, tutarsız padding.
- Uzun narratifler (StockDetail Tabs, SettingsView açıklamaları) hep açık → dikey uzuyor.

### Responsive / mobil-masaüstü hissi
- Mobilde **bottom tab bar yok**; üst nav yatay scroll sekme → mobil uygulama hissi zayıf.
- `viewport-fit=cover` + safe-area inset yok (çentik / ana ekran çubuğu).
- `MarketHeader` mobilde 3-4 satıra sarıyor; ticker kompakt değil.
- Masaüstünde tek kolon + yalnızca dashboard'da sağ rail; `sidebar` primitivi hiç kullanılmamış → workstation hissi yok.
- Dokunma hedefleri yer yer <44px (`py-1.5` satırlar, `h-6/h-7` butonlar).
- `use-mobile` breakpoint 768 tek kademe; 3 kademeli strateji yok.

### PWA
- `manifest.json` var ama ikonlar **harici URL** (`z-cdn…`) → installability güvenilmez; 192/512 + maskable yok.
- **Service worker yok** → offline / background yok.
- Apple meta tagleri (`apple-touch-icon`, `mobile-web-app-capable`, status-bar) yok.
- Install prompt (`beforeinstallprompt`) yakalanmıyor.

## 4. Hedef Tasarım Sistemi

- **Density token'ları:** `--space-card`, `--space-row`; kart `py-3 px-3 gap-3`, header `pb-1.5`; satırlar `divide-y py-1.5`; tüm sayılar `tabular-nums`; temel metin `text-xs/[11px]`.
- **Ortak atomlar:** tek `StatBox` (5 tekrarı birleştir), `SectionCard`, `RowButton`, `Pill`.
- **Breakpoint:** `<640` mobil-app · `640–1024` tablet · `≥1024` desktop-app · `≥1536` wide.
- **Mobil-app:** sabit kondanse üst app-bar + **bottom tab bar (5 sekme, safe-area)**, edge-to-edge kartlar (12px gutter), ikincil aksiyonlar Sheet/Drawer, snap-carousel picks, min 44px hedef.
- **Desktop-app:** sol **collapsible sidebar** (icon+label), üst komut çubuğu, kalıcı sağ alert rail, yoğun çok-kolon grid, klavye kısayolları (`1-5`, `/`), hover/focus durumları.

## 5. Uygulama Fazları

### Faz 0 — Temizlik & baseline
- Kullanılmayan 32 ui dosyasını sil.
- `npm run lint`, `npx tsc --noEmit`, `npm run build` yeşil baz çizgisi.

### Faz 1 — Token + kompakt primitiveler
- `globals.css`: density token'ları, kompakt kart/satır stilleri.
- `card / button / input / badge / tabs / select` boyut küçültme.
- `StatBox / SectionCard / RowButton / Pill` ortak atomlarını ekle.

### Faz 2 — Adaptif kabuk
- `AppShell`: mobil bottom-bar + desktop sidebar + safe-area + `viewport-fit=cover`.
- `MarketHeader`: kondanse ticker (mobilde yatay scroll marquee).
- Footer'ı mobilde gizle.

### Faz 3 — Görünüm kompaktlaştırma
- Dashboard: 2 → 3 kolon yoğun grid.
- TodayPicks: mobilde snap-carousel.
- StockDetail: yoğun grid + accordion narratif.
- PortfolioView: tablo-benzeri satırlar.
- ScannerView: sticky çip satırı.
- SettingsView: bölüm accordion.

### Faz 4 — PWA
- `sharp` ile local 192/512 + maskable ikon üret.
- Manifest v2 (`display_override`, shortcuts).
- El yazımı `public/sw.js`: precache shell, `/api/*` network-first + fallback, static cache-first, offline sayfası.
- `layout.tsx`'te SW kaydı; apple meta tagleri.
- Install-prompt butonu (Ayarlar + header).

### Faz 5 — Doğrulama
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Görsel QA: 360 / 390 / 768 / 1024 / 1440 / 1920.
- Lighthouse PWA installability.
