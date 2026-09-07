/**
 * Gmail e-posta ayarları — kullanıcı kendi Gmail App Password ile bağlar.
 *
 * Güvenlik:
 *  - Uygulama şifresi AES-256-GCM ile şifrelenerek saklanır (SQLite veya /tmp fallback)
 *  - Anahtar: MAIL_SECRET env (yoksa türetilmiş sunucu sırrı)
 *  - Şifre asla istemciye geri dönmez
 */

import { NextResponse } from "next/server";
import { getEmailSettings, setEmailSettings, deleteEmailSettings } from "@/lib/alerts/email-store";
import { encryptSecret, decryptSecret } from "@/lib/alerts/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await getEmailSettings();
  if (!row) {
    return NextResponse.json({ configured: false, email: null, lossAlert: true, lossThresholdPct: 5, profitAlert: true, profitTargetPct: 5, dailyReport: true, hasPassword: false, persistent: null });
  }
  return NextResponse.json({
    configured: Boolean(row.email && row.appPasswordEnc),
    email: row.email,
    lossAlert: row.lossAlert,
    lossThresholdPct: row.lossThresholdPct,
    profitAlert: row.profitAlert,
    profitTargetPct: row.profitTargetPct,
    dailyReport: row.dailyReport,
    hasPassword: Boolean(row.appPasswordEnc),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    appPassword?: string;
    lossAlert?: boolean;
    lossThresholdPct?: number;
    profitAlert?: boolean;
    profitTargetPct?: number;
    dailyReport?: boolean;
  } | null;

  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi gerekli." }, { status: 400 });
  }
  if (!body.appPassword || body.appPassword.trim().length < 8) {
    return NextResponse.json({ error: "Gmail Uygulama Şifresi gerekli (en az 8 karakter). Google Hesabı > Güvenlik > 2 Adımlı Doğrulama > Uygulama Şifreleri'nden oluşturabilirsiniz." }, { status: 400 });
  }

  const enc = encryptSecret(body.appPassword.trim());
  const saved = await setEmailSettings({
    email: body.email.trim().toLowerCase(),
    appPasswordEnc: enc,
    lossAlert: body.lossAlert ?? true,
    lossThresholdPct: typeof body.lossThresholdPct === "number" ? body.lossThresholdPct : 5,
    profitAlert: body.profitAlert ?? true,
    profitTargetPct: typeof body.profitTargetPct === "number" ? body.profitTargetPct : 5,
    dailyReport: body.dailyReport ?? true,
  });

  const ok = Boolean(decryptSecret(enc));
  return NextResponse.json({
    ok,
    persistent: saved.persistent,
    note: ok
      ? saved.persistent
        ? "Gmail bağlantısı kaydedildi. Düşüş, kâr hedefi ve günlük rapor e-postaları bu adrese gelecek."
        : "Gmail bağlantısı kaydedildi (geçici depolama). Uyarılar site açıkken her durumda çalışır."
      : "Şifreleme doğrulaması başarısız.",
  });
}

export async function DELETE() {
  await deleteEmailSettings();
  return NextResponse.json({ ok: true, note: "Gmail bağlantısı kaldırıldı." });
}
