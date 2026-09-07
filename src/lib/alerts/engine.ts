"use client";

/**
 * Uyarı Motoru (client-side)
 * Canlı fiyatlama verisini izler; eşik aşımı, hedef, stop, destek/direnç olaylarını tespit eder.
 * Akıllı cooldown: aynı uyarı tekrar spam edilmez.
 * Tarayıcı bildirimi + (yapılandırıldıysa) e-posta gönderir.
 */

import { usePortfolio } from "@/lib/store/portfolio";
import { useSettings } from "@/lib/store/settings";

export interface AlertEvent {
  symbol: string;
  type: "DROP" | "RISE" | "TARGET" | "STOP_NEAR" | "STOP_BREACH" | "WEEKLY_LOSS" | "WEEKLY_PROFIT" | "INFO";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
}

const lastFired = new Map<string, number>();

function cooldownOk(key: string, minutes: number): boolean {
  const last = lastFired.get(key);
  if (last && Date.now() - last < minutes * 60_000) return false;
  lastFired.set(key, Date.now());
  return true;
}

interface PositionSnapshot {
  symbol: string;
  quantity: number;
  avgCost: number;
  price: number;
  changePercent: number;
  changePctFromCost: number;
  dailyPL: number;
  weeklyPL: number;
  totalPL: number;
}

/**
 * Pozisyonları canlı fiyatlara karşı değerlendir; uyarı listesi döndür.
 * weeklyPct: son 5 işlem günü değişimi (server'dan gelir)
 */
export function evaluateAlerts(
  snapshots: PositionSnapshot[],
  context: { supports?: Record<string, number>; resistance?: Record<string, number>; stopLoss?: Record<string, number>; target1?: Record<string, number> } = {}
): AlertEvent[] {
  const settings = useSettings.getState();
  const { logAlert } = usePortfolio.getState();
  const events: AlertEvent[] = [];

  for (const s of snapshots) {
    const pct = s.changePctFromCost;
    const key = (t: string) => `${s.symbol}:${t}:${Math.floor(pct)}`;

    // Düşüş uyarısı
    if (pct <= -settings.dropAlertPct && cooldownOk(key("drop"), settings.cooldownMinutes)) {
      const ev: AlertEvent = {
        symbol: s.symbol,
        type: "DROP",
        severity: pct <= -settings.dropAlertPct * 2 ? "critical" : "warning",
        title: `${s.symbol} -%${Math.abs(pct).toFixed(1)} düştü`,
        message: `Maliyet ${s.avgCost.toFixed(2)} TL üzerinden -%${Math.abs(pct).toFixed(1)} zarar konumundasınız. Günlük değişim ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(1).replace(".", ",")}%. Düşüşün nedenini analiz edin: piyasa geneli mi, hisseye özel mi? Destek seviyesinin kırılıp kırılmadığını kontrol edin. Pozisyon değerlendirmesinde ajanın önerisi (bekle / risk azalt / çıkış) yer alır.`,
      };
      events.push(ev);
    }

    // Yükseliş / hedef uyarısı
    if (pct >= settings.targetAlertPct && cooldownOk(key("target"), settings.cooldownMinutes)) {
      const cont = s.changePercent > 0;
      events.push({
        symbol: s.symbol,
        type: "TARGET",
        severity: "info",
        title: `${s.symbol} +%${pct.toFixed(1)} kâr hedefine ulaştı`,
        message: cont
          ? `Kâr +%${pct.toFixed(1)}. Ancak günlük momentum pozitif (+%${s.changePercent.toFixed(1)} gün içi) — trend henüz bozulmadı. Kademeli kâr realizasyonu veya trailing stop değerlendirilebilir; hemen tümünü kapatmak zorunda değilsiniz.`
          : `Kâr +%${pct.toFixed(1)} ancak gün içi momentum zayıflıyor (-%${Math.abs(s.changePercent).toFixed(1)}). Kârı koruma öncelikli hale geldi; kademeli realizasyon düşünülebilir.`,
      });
    } else if (pct >= settings.riseAlertPct && pct < settings.targetAlertPct && cooldownOk(key("rise"), settings.cooldownMinutes)) {
      events.push({
        symbol: s.symbol,
        type: "RISE",
        severity: "info",
        title: `${s.symbol} +%${pct.toFixed(1)} yükseldi`,
        message: `Pozisyonunuz kâr bölgesinde. Günlük değişim ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(1).replace(".", ",")}%. Hedef seviyesine (%${settings.targetAlertPct}) yaklaşmadan önce trend gücünü izleyin.`,
      });
    }

    // Stop bölgesi
    const stop = context.stopLoss?.[s.symbol];
    if (stop && s.price <= stop * 1.03 && s.price > stop && cooldownOk(`${s.symbol}:stopnear`, settings.cooldownMinutes)) {
      events.push({
        symbol: s.symbol,
        type: "STOP_NEAR",
        severity: "warning",
        title: `${s.symbol} stop bölgesine yaklaştı`,
        message: `Mevcut fiyat ${s.price.toFixed(2)} TL, stop seviyesi ${stop.toFixed(2)} TL. Stop bölgesine girmeden önce pozisyon değerlendirmesini okuyun.`,
      });
    }
    if (stop && s.price <= stop && cooldownOk(`${s.symbol}:stopbr`, settings.cooldownMinutes)) {
      events.push({
        symbol: s.symbol,
        type: "STOP_BREACH",
        severity: "critical",
        title: `${s.symbol} stop seviyesi altına indi`,
        message: `Fiyat ${s.price.toFixed(2)} TL, stop ${stop.toFixed(2)} TL. Teknik senaryo geçersizleşti. Çıkış veya risk azaltma kararını pozisyon detayında bulabilirsiniz.`,
      });
    }
  }

  // Logla ve bildir
  for (const ev of events) {
    logAlert({ symbol: ev.symbol, type: ev.type, message: `${ev.title} — ${ev.message}` });
    if (typeof window !== "undefined") {
      if (settings.browserNotify && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`[${ev.severity === "critical" ? "KIRMIZI" : ev.severity === "warning" ? "UYARI" : "BİLGİ"}] ${ev.title}`, {
            body: ev.message.slice(0, 220),
            tag: `${ev.symbol}-${ev.type}`,
          });
        } catch {
          // bildirim hatası — yut
        }
      }
      if (settings.soundNotify) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = ev.severity === "critical" ? 880 : 660;
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } catch {
          // yut
        }
      }
    }
    // E-posta (yapılandırıldıysa)
    if (settings.emailEnabled && settings.emailTo) {
      void sendEmailAlert(ev, settings.emailTo);
    }
  }

  return events;
}

async function sendEmailAlert(ev: AlertEvent, to: string) {
  try {
    await fetch("/api/notify/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject: `[BIST AI Terminal] ${ev.title}`,
        text: `${ev.message}\n\nBu otomatik bir analiz bilgilendirmesidir; yatırım tavsiyesi değildir.`,
      }),
    });
  } catch {
    // e-posta hatası sessiz — tarayıcı bildirimi zaten gitti
  }
}

export async function testNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}
