import { NextResponse } from "next/server";
import { getEmailSettings, updateEmailSettings } from "@/lib/alerts/email-store";
import { sendMail, buildReportHtml } from "@/lib/alerts/mailer";
import { generateDailyPicks } from "@/lib/analysis/picks";
import { getQuotes } from "@/lib/market/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Zamanlanmış görev (Vercel Cron — işlem günleri 07:00 UTC = 10:00 TR, borsa açılışı):
 *  1) Günlük rapor: bugünün seçimleri + kayıtlı portföy durumu
 *  2) Düşüş uyarısı: kayıtlı pozisyonlar eşik altındaysa
 *  3) Kâr hedefi uyarısı: eşik üstündeyse
 *
 * Yetkilendirme: CRON_SECRET env varsa Authorization header doğrulanır.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  const settings = await getEmailSettings();
  if (!settings || !settings.appPasswordEnc) {
    return NextResponse.json({ ok: true, note: "Kayıtlı kullanıcı yok — gönderilecek e-posta bulunamadı." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const picks = await generateDailyPicks();
  const messages: string[] = [];

  // Portföy anlık görüntüsü
  let snapshot: Array<{ symbol: string; quantity: number; avgCost: number }> = [];
  try {
    snapshot = settings.positionsJson ? (JSON.parse(settings.positionsJson) as typeof snapshot) : [];
  } catch {
    snapshot = [];
  }

  let portfolio = { totalValue: 0, dailyPL: 0, totalPL: 0, totalPLPct: 0 };
  let built: Array<{ symbol: string; quantity: number; avgCost: number; price: number; prevClose: number; plTL: number; plPct: number }> = [];
  if (snapshot.length > 0) {
    const { quotes } = await getQuotes(snapshot.map((p) => p.symbol));
    built = snapshot
      .filter((p) => quotes[p.symbol])
      .map((p) => {
        const q = quotes[p.symbol];
        const plTL = (q.price - p.avgCost) * p.quantity;
        const plPct = p.avgCost > 0 ? ((q.price - p.avgCost) / p.avgCost) * 100 : 0;
        return { ...p, price: q.price, prevClose: q.prevClose, plTL, plPct };
      });
    portfolio = {
      totalValue: built.reduce((a, p) => a + p.quantity * p.price, 0),
      dailyPL: built.reduce((a, p) => a + p.quantity * (p.price - p.prevClose), 0),
      totalPL: built.reduce((a, p) => a + p.plTL, 0),
      totalPLPct: 0,
    };
    const totalCost = built.reduce((a, p) => a + p.quantity * p.avgCost, 0);
    portfolio.totalPLPct = totalCost > 0 ? (portfolio.totalPL / totalCost) * 100 : 0;
  }

  // 1) Düşüş uyarısı
  if (settings.lossAlert && built.length > 0 && portfolio.totalPLPct <= -settings.lossThresholdPct) {
    const res = await sendMail({
      to: settings.email,
      subject: `🚨 [BIST AI] DİKKAT: Portföyünüz %${portfolio.totalPLPct.toFixed(2)} Kayıpta`,
      html: buildReportHtml({
        title: "⚠️ Düşüş Uyarısı",
        intro: `Portföyünüz belirlediğiniz %${settings.lossThresholdPct} kayıp eşiğinin altına indi (%${portfolio.totalPLPct.toFixed(2)}). Pozisyonlarınızı ve stop seviyelerini kontrol edin.`,
        positions: built.map((p) => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost, price: p.price, plPct: p.plPct, plTL: p.plTL })),
        portfolio,
        footerNote: "Bu uyarı kayıtlı pozisyon anlık görüntünüzden üretilmiştir. Yatırım tavsiyesi değildir.",
      }),
    });
    messages.push(res.ok ? "düşüş uyarısı gönderildi" : `düşüş uyarısı hatası: ${res.error}`);
  }

  // 2) Kâr hedefi uyarısı
  if (settings.profitAlert && built.length > 0 && portfolio.totalPLPct >= settings.profitTargetPct) {
    const res = await sendMail({
      to: settings.email,
      subject: `🎯 [BIST AI] TEBRİKLER: Portföyünüz %${portfolio.totalPLPct.toFixed(2)} Kârda — Hedefe Ulaştı`,
      html: buildReportHtml({
        title: "🎉 Kâr Hedefi Gerçekleşti",
        intro: `Portföyünüz belirlediğiniz %${settings.profitTargetPct} kâr hedefine ulaştı (mevcut: +%${portfolio.totalPLPct.toFixed(2)} = +${portfolio.totalPL.toFixed(2)} TL). Kâr realizasyonu değerlendirmesi yapabilirsiniz.`,
        positions: built.map((p) => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost, price: p.price, plPct: p.plPct, plTL: p.plTL })),
        portfolio,
        footerNote: "Kâr hedefi bilgilendirmesidir; karar size aittir. Yatırım tavsiyesi değildir.",
      }),
    });
    messages.push(res.ok ? "kâr hedefi uyarısı gönderildi" : `kâr hedefi uyarısı hatası: ${res.error}`);
  }

  // 3) Günlük rapor (günde bir)
  if (settings.dailyReport && settings.lastReportDate !== today) {
    const res = await sendMail({
      to: settings.email,
      subject: `📊 [BIST AI] Günlük Rapor — Bugünün Seçimleri (${new Date().toLocaleDateString("tr-TR")})`,
      html: buildReportHtml({
        title: "Günlük Rapor: Bugünün Seçimleri",
        intro: picks.headline,
        picks: picks.picks.map((p) => ({ symbol: p.symbol, price: p.price, todayTarget: p.todayTarget, todayTargetPct: p.todayTargetPct, confidence: p.confidence, profitPer100: p.profitPer100, reason: p.reason })),
        positions: built.map((p) => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost, price: p.price, plPct: p.plPct, plTL: p.plTL })),
        portfolio: built.length > 0 ? portfolio : undefined,
        footerNote: picks.disclaimer,
      }),
    });
    if (res.ok) {
      await updateEmailSettings({ lastReportDate: today });
      messages.push("günlük rapor gönderildi");
    } else {
      messages.push(`günlük rapor hatası: ${res.error}`);
    }
  }

  return NextResponse.json({ ok: true, messages, at: new Date().toISOString() });
}
