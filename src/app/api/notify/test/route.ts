import { NextResponse } from "next/server";
import { getEmailSettings } from "@/lib/alerts/email-store";
import { sendMail } from "@/lib/alerts/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Kayıtlı Gmail bağlantısıyla test e-postası gönderir */
export async function POST() {
  const row = await getEmailSettings();
  if (!row || !row.appPasswordEnc) {
    return NextResponse.json(
      { error: "Gmail bağlantısı henüz kurulmadı. Ayarlar > E-posta Uyarıları bölümünden e-posta adresinizi ve Uygulama Şifrenizi kaydedin." },
      { status: 400 }
    );
  }
  const res = await sendMail({
    to: row.email,
    subject: "[BIST AI Terminal] Test Bildirimi — Bağlantı Başarılı",
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#059669;color:#fff;border-radius:8px;padding:14px 18px;font-size:16px;font-weight:bold;">✅ Gmail bağlantınız çalışıyor</div>
      <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;padding:16px 18px;font-size:13px;line-height:1.6;">
        Bu test e-postası, <b>${row.email}</b> adresine başarıyla gönderildi.
        <br><br>Bundan sonra bu adrese şunlar gelecek:
        <ul style="padding-left:18px;margin:8px 0;">
          <li><b>Düşüş uyarısı:</b> portföyünüz ${row.lossThresholdPct}% kayıpa ulaştığında</li>
          <li><b>Kâr hedefi uyarısı:</b> ${row.profitTargetPct}% kazanç hedefine ulaştığınızda</li>
          ${row.dailyReport ? "<li><b>Günlük rapor:</b> ajanın bugünkü seçimleri + portföy durumu</li>" : ""}
        </ul>
      </div>
    </div>`,
    text: "Gmail bağlantınız çalışıyor. Düşüş, kâr hedefi ve günlük rapor e-postaları bu adrese gönderilecek.",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true, note: `Test e-postası ${row.email} adresine gönderildi — gelen kutunuzu kontrol edin.` });
}
