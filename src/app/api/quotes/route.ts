import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market/providers";
import { findStock } from "@/lib/market/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 80);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols parametresi gerekli" }, { status: 400 });
  }

  try {
    const { quotes, errors, source, fetchedAt } = await getQuotes(symbols);
    return NextResponse.json({
      quotes,
      errors,
      source,
      sourceNote:
        source === "midas"
          ? "Veri kaynağı: Midas"
          : source === "tradingview-bist"
            ? "Veri kaynağı: TradingView Türkiye — resmî BIST borsa verisi (Midas'ta görüntülenenle aynı fiyat)."
            : "Veri kaynağı: Yahoo Finance — İstanbul Borsası (yedek).",
      fetchedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Piyasa verisi alınamadı.", detail: e instanceof Error ? e.message : "bilinmeyen hata" },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}

// findStock kullanılmıyor olsa da sembol doğrulama için dışa açık kalsın
void findStock;
