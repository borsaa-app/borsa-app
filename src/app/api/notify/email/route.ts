import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/**
 * E-posta bildirim servisi (Gmail SMTP).
 * .env içinde şunlar tanımlı olmalı:
 *   GMAIL_USER=kullanici@gmail.com
 *   GMAIL_APP_PASSWORD=uygulama_sifresi (16 haneli App Password)
 * Tanımlı değilse API, yapılandırılmadığını dürüstçe bildirir — sahte gönderim yapılmaz.
 */

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

export async function GET() {
  const configured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  return NextResponse.json({
    configured,
    note: configured
      ? "E-posta bildirimleri yapılandırıldı (Gmail SMTP)."
      : "E-posta bildirimi yapılandırılmadı. Sunucu tarafında GMAIL_USER ve GMAIL_APP_PASSWORD environment değişkenleri tanımlanmalıdır. Bu değişkenler olmadan e-posta gönderilmez (sahte gönderim yapılmaz). Tarayıcı bildirimleri yapılandırmaya gerek duymadan çalışır.",
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  } | null;

  if (!body?.to || !body?.subject || (!body.text && !body.html)) {
    return NextResponse.json({ error: "to, subject ve text/html alanları gerekli." }, { status: 400 });
  }

  const transport = getTransport();
  if (!transport) {
    return NextResponse.json(
      {
        error: "E-posta servisi yapılandırılmadı.",
        note: "GMAIL_USER ve GMAIL_APP_PASSWORD environment değişkenleri tanımlanmalıdır. Gmail App Password oluşturmak için: Google Hesabı > Güvenlik > 2 Adımlı Doğrulama > Uygulama Şifreleri.",
      },
      { status: 503 }
    );
  }

  try {
    const info = await transport.sendMail({
      from: `BIST AI Terminal <${process.env.GMAIL_USER}>`,
      to: body.to,
      subject: body.subject,
      text: body.text ?? "",
      html: body.html,
    });
    return NextResponse.json({ ok: true, messageId: info.messageId, sentAt: Date.now() });
  } catch (e) {
    return NextResponse.json(
      { error: "E-posta gönderilemedi.", detail: e instanceof Error ? e.message : "bilinmeyen hata" },
      { status: 502 }
    );
  }
}
