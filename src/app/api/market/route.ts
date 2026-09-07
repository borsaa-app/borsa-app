import { NextResponse } from "next/server";
import { getRawQuote } from "@/lib/market/providers";
import { getRegime } from "@/lib/market/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [bist100, bist30, usdtry, eurtry, gold, brent] = await Promise.all([
      getRawQuote("XU100.IS"),
      getRawQuote("XU030.IS"),
      getRawQuote("USDTRY=X"),
      getRawQuote("EURTRY=X"),
      getRawQuote("GC=F"),
      getRawQuote("BZ=F"),
    ]);
    const regime = await getRegime();

    return NextResponse.json({
      indices: {
        bist100: bist100.data,
        bist30: bist30.data,
        usdtry: usdtry.data,
        eurtry: eurtry.data,
        gold: gold.data,
        brent: brent.data,
      },
      errors: {
        bist100: bist100.error,
        usdtry: usdtry.error,
      },
      regime,
      source: "yahoo-finance",
      sourceNote:
        "Veri kaynağı: Yahoo Finance — İstanbul Borsası / CME. Midas canlı veri bağlantısı bu ortamda kapalı; BIST verileri borsa saatlerinde ~15 dk gecikmeli olabilir.",
      fetchedAt: Date.now(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Piyasa özeti alınamadı.", detail: e instanceof Error ? e.message : "bilinmeyen hata" },
      { status: 502 }
    );
  }
}
