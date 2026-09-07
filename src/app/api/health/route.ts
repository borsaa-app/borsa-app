import { NextResponse } from "next/server";
import { getQuotes, getRawQuote } from "@/lib/market/providers";

export const dynamic = "force-dynamic";

/** Veri sağlayıcı sağlık durumu — kullanıcıya gerçek bağlantı durumu gösterilir */
export async function GET() {
  const [testQuote, indexQuote] = await Promise.all([getQuotes(["THYAO"]), getRawQuote("XU100.IS")]);
  const yahooOk = Boolean(testQuote.quotes["THYAO"]);

  return NextResponse.json({
    status: yahooOk ? "ok" : "degraded",
    providers: {
      midas: {
        available: testQuote.source === "midas",
        note: testQuote.source === "midas"
          ? "Midas veri bağlantısı aktif."
          : "Midas kamuya açık canlı veri API'si bu ortamdan erişilemiyor. Yedek kaynak devrede.",
      },
      "yahoo-finance": {
        available: yahooOk,
        note: "İstanbul Borsası fiyat verileri (borsa saatlerinde ~15 dk gecikmeli).",
        testSymbol: "THYAO",
        testPrice: testQuote.quotes["THYAO"]?.price ?? null,
        latencyOk: Boolean(indexQuote.data),
      },
    },
    checkedAt: Date.now(),
  });
}
