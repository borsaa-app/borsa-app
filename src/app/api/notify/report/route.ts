import { NextResponse } from "next/server";
import { getEmailSettings, updateEmailSettings } from "@/lib/alerts/email-store";
import { sendMail, buildReportHtml } from "@/lib/alerts/mailer";
import { generateDailyPicks } from "@/lib/analysis/picks";
import { getQuotes } from "@/lib/market/providers";
import { getAllPositions } from "@/lib/db/positions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Anında portföy raporu: DB'den pozisyonları çeker veya istemciden alır,
 * sunucu gerçek fiyatlarla K/Z hesaplar + bugünün seçimlerini ekleyip e-postalar.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    positions?: Array<{ symbol: string; quantity: number; avgCost: number }>;
  } | null;

  const row = await getEmailSettings();
  if (!row || !row.appPasswordEnc) {
    return NextResponse.json({ error: "Gmail bağlantısı kurulmadı. Önce Ayarlar'dan Gmail hesabınızı bağlayın." }, { status: 400 });
  }

  // DB'den pozisyonları çek, yoksa istemciden gelenleri kullan
  let positions = body?.positions ?? [];
  if (positions.length === 0) {
    const dbPositions = await getAllPositions();
    positions = dbPositions.map((p) => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost }));
  }

  // Gerçek fiyatlarla K/Z
  let reportPositions: ReturnType<typeof buildPositions> = [];
  let portfolio = { totalValue: 0, dailyPL: 0, totalPL: 0, totalPLPct: 0 };
  if (positions.length > 0) {
    const syms = positions.map((p) => p.symbol);
    const { quotes } = await getQuotes(syms);
    reportPositions = buildPositions(positions, quotes);
    portfolio = {
      totalValue: reportPositions.reduce((a, p) => a + p.quantity * p.price, 0),
      dailyPL: reportPositions.reduce((a, p) => a + p.quantity * (p.price - p.prevClose), 0),
      totalPL: reportPositions.reduce((a, p) => a + p.plTL, 0),
      totalPLPct: 0,
    };
    const totalCost = reportPositions.reduce((a, p) => a + p.quantity * p.avgCost, 0);
    portfolio.totalPLPct = totalCost > 0 ? (portfolio.totalPL / totalCost) * 100 : 0;
  }

  // Bugünün seçimleri
  const picks = await generateDailyPicks();

  const res = await sendMail({
    to: row.email,
    subject: `📊 [BIST AI Terminal] Portföy Raporu + Bugünün Seçimleri — ${new Date().toLocaleDateString("tr-TR")}`,
    html: buildReportHtml({
      title: "Portföy Raporu + Bugünün Seçimleri",
      intro: positions.length > 0
        ? "Portföyünüz gerçek zamanlı resmî BIST fiyatlarıyla değerlendirildi ve ajanın bugünkü yükseliş seçimleri eklendi."
        : "Portföyünüzde pozisyon görünmüyor. Ajanın bugünkü yükseliş seçimleri aşağıda — 100 TL'den başlayarak değerlendirebilirsiniz.",
      picks: picks.picks.map((p) => ({ symbol: p.symbol, price: p.price, todayTarget: p.todayTarget, todayTargetPct: p.todayTargetPct, confidence: p.confidence, profitPer100: p.profitPer100, reason: p.reason })),
      positions: reportPositions.map((p) => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost, price: p.price, plPct: p.plPct, plTL: p.plTL })),
      portfolio,
      footerNote: picks.disclaimer,
    }),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });

  // Zamanlanmış uyarılar için pozisyon anlık görüntüsünü güncelle
  await updateEmailSettings({ positionsJson: JSON.stringify(positions) });

  return NextResponse.json({ ok: true, note: `Rapor ${row.email} adresine gönderildi.` });
}

function buildPositions(positions: Array<{ symbol: string; quantity: number; avgCost: number }>, quotes: Record<string, { price: number; prevClose: number }>) {
  return positions
    .filter((p) => quotes[p.symbol])
    .map((p) => {
      const q = quotes[p.symbol];
      const plTL = (q.price - p.avgCost) * p.quantity;
      const plPct = p.avgCost > 0 ? ((q.price - p.avgCost) / p.avgCost) * 100 : 0;
      return { ...p, price: q.price, prevClose: q.prevClose, plTL, plPct };
    });
}
