/**
 * E-posta gönderim katmanı:
 *  - Kullanıcının kayıtlı Gmail bağlantısı (DB'de şifreli) ile SMTP transport
 *  - GMAIL_USER/GMAIL_APP_PASSWORD env yedeği (sunucu sahibi hesabı)
 *  - Günlük rapor HTML üretimi: bugünün seçimleri + portföy K/Z
 */

import nodemailer from "nodemailer";
import { getEmailSettings } from "./email-store";
import { decryptSecret } from "./crypto";

export interface MailCreds {
  user: string;
  pass: string;
  from: string;
  source: "kullanici-gmail" | "sunucu-gmail";
}

export async function getMailCreds(): Promise<MailCreds | null> {
  // 1) Kullanıcının kendi Gmail bağlantısı
  const row = await getEmailSettings();
  if (row?.appPasswordEnc) {
    const pass = decryptSecret(row.appPasswordEnc);
    if (pass) return { user: row.email, pass, from: `BIST AI Terminal <${row.email}>`, source: "kullanici-gmail" };
  }
  // 2) Sunucu hesabı (env)
  const u = process.env.GMAIL_USER;
  const p = process.env.GMAIL_APP_PASSWORD;
  if (u && p) return { user: u, pass: p, from: `BIST AI Terminal <${u}>`, source: "sunucu-gmail" };
  return null;
}

export function makeTransport(creds: MailCreds) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
  });
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const creds = await getMailCreds();
  if (!creds) return { ok: false, error: "Gmail bağlantısı yapılandırılmadı. Ayarlar > E-posta Uyarıları bölümünden Gmail hesabınızı bağlayın." };
  try {
    const transport = makeTransport(creds);
    const info = await transport.sendMail({
      from: creds.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      html: opts.html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bilinmeyen hata";
    if (msg.includes("Invalid login") || msg.includes("EAUTH")) {
      return { ok: false, error: "Gmail girişi başarısız — e-posta adresi ve 16 haneli Uygulama Şifresi doğru mu? (Normal Gmail şifresi kabul edilmez.)" };
    }
    return { ok: false, error: msg };
  }
}

/* ------------------------------------------------------------------ */
/* Rapor HTML üretimi                                                  */
/* ------------------------------------------------------------------ */

export interface ReportPick {
  symbol: string;
  price: number;
  todayTarget: number;
  todayTargetPct: number;
  confidence: number;
  profitPer100: number;
  reason: string;
}

export interface ReportPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  price: number;
  plPct: number;
  plTL: number;
}

export interface ReportData {
  title: string;
  intro: string;
  picks?: ReportPick[];
  positions?: ReportPosition[];
  portfolio?: { totalValue: number; dailyPL: number; totalPL: number; totalPLPct: number };
  footerNote: string;
}

const box = (bg: string, border: string, inner: string) =>
  `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:12px 14px;margin:8px 0;">${inner}</div>`;

export function buildReportHtml(d: ReportData): string {
  let html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111;">
  <div style="background:#0f172a;color:#fff;border-radius:10px 10px 0 0;padding:16px 20px;">
    <div style="font-size:18px;font-weight:bold;">📊 ${d.title}</div>
    <div style="font-size:12px;opacity:.75;margin-top:4px;">BIST AI Yatırım Terminali · ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px;padding:18px 20px;">`;
  html += `<p style="font-size:13px;line-height:1.6;">${d.intro}</p>`;

  if (d.portfolio) {
    const p = d.portfolio;
    const tone = p.dailyPL >= 0 ? "#059669" : "#dc2626";
    html += box("#f8fafc", "#e2e8f0", `
      <div style="font-size:12px;color:#64748b;">PORTFÖY DURUMU</div>
      <div style="font-size:22px;font-weight:bold;margin:4px 0;">${p.totalValue.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL</div>
      <div style="font-size:13px;color:${tone};font-weight:bold;">Bugünkü K/Z: ${p.dailyPL >= 0 ? "+" : ""}${p.dailyPL.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL · Toplam: ${p.totalPL >= 0 ? "+" : ""}${p.totalPL.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL (%${p.totalPLPct.toFixed(2)})</div>`);
  }

  if (d.picks && d.picks.length > 0) {
    html += `<div style="font-size:13px;font-weight:bold;margin:14px 0 6px;">🎯 AJANIN BUGÜNKÜ SEÇİMLERİ</div>`;
    for (const pk of d.picks) {
      html += box("#ecfdf5", "#a7f3d0", `
        <div style="font-size:14px;font-weight:bold;">${pk.symbol} <span style="color:#059669;">HEDEF ${pk.todayTarget} TL (+%${pk.todayTargetPct})</span></div>
        <div style="font-size:12px;color:#374151;margin-top:3px;">Fiyat: ${pk.price} TL · Güven: %${pk.confidence} · <b>100 TL ile beklenen kazanç: ~${pk.profitPer100} TL</b></div>
        <div style="font-size:11px;color:#64748b;margin-top:3px;">${pk.reason}</div>`);
    }
  }

  if (d.positions && d.positions.length > 0) {
    html += `<div style="font-size:13px;font-weight:bold;margin:14px 0 6px;">📌 POZİSYONLARINIZ</div><table style="width:100%;border-collapse:collapse;font-size:12px;">`;
    html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Hisse</th><th style="text-align:right;padding:6px;">Adet</th><th style="text-align:right;padding:6px;">Maliyet</th><th style="text-align:right;padding:6px;">Son</th><th style="text-align:right;padding:6px;">K/Z</th></tr>`;
    for (const pos of d.positions) {
      const tone = pos.plTL >= 0 ? "#059669" : "#dc2626";
      html += `<tr style="border-top:1px solid #e2e8f0;"><td style="padding:6px;font-weight:bold;">${pos.symbol}</td><td style="text-align:right;padding:6px;">${pos.quantity}</td><td style="text-align:right;padding:6px;">${pos.avgCost} TL</td><td style="text-align:right;padding:6px;">${pos.price} TL</td><td style="text-align:right;padding:6px;color:${tone};font-weight:bold;">${pos.plTL >= 0 ? "+" : ""}${pos.plTL.toFixed(2)} TL (%${pos.plPct.toFixed(2)})</td></tr>`;
    }
    html += `</table>`;
  }

  html += `<p style="font-size:11px;color:#94a3b8;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:10px;">${d.footerNote}</p>
  </div></div>`;
  return html;
}
