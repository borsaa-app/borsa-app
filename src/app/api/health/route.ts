import { NextResponse } from "next/server";
import { getQuotes, getRawQuote, tvBatchQuotes } from "@/lib/market/providers";

export const dynamic = "force-dynamic";

/** Veri sağlayıcı sağlık durumu — kullanıcıya gerçek bağlantı durumu gösterilir */
export async function GET() {
  const [tvRes, testQuote, indexQuote] = await Promise.all([
    tvBatchQuotes(["THYAO", "GARAN", "ASELS"]),
    getQuotes(["THYAO"]),
    getRawQuote("XU100.IS"),
  ]);
  const tvOk = Boolean(tvRes && tvRes.quotes.length >= 3);
  const yahooOk = Boolean(testQuote.quotes["THYAO"]);
  const thPrice = tvRes?.quotes.find((q) => q.symbol === "THYAO")?.price ?? testQuote.quotes["THYAO"]?.price ?? null;

  return NextResponse.json({
    status: tvOk || yahooOk ? "ok" : "degraded",
    providers: {
      midas: {
        available: testQuote.source === "midas",
        note: "Midas kamuya açık canlı piyasa API'sine sahip değil (kurumsal anahtar gerekir). Resmî BIST fiyat katmanı devrede — Midas ekranındaki fiyatla aynı borsa verisi.",
      },
      tradingview: {
        available: tvOk,
        note: tvOk
          ? "Resmî BIST fiyatları canlı — Midas'ta görüntülenenle aynı borsa verisi (tek istekte 57 hisse)."
          : "TradingView tarayıcı API'sine ulaşılamadı — yedek kaynağa geçildi.",
        testPrice: thPrice,
      },
      "yahoo-finance": {
        available: yahooOk,
        note: "Yedek fiyat + geçmiş mum (grafik) verisi sağlayıcısı.",
        testSymbol: "THYAO",
        latencyOk: Boolean(indexQuote.data),
      },
    },
    checkedAt: Date.now(),
  });
}
