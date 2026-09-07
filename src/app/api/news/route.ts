import { NextResponse } from "next/server";
import { getStockNews, aggregateNews } from "@/lib/market/news";
import { findStock } from "@/lib/market/symbols";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();
  const limit = Math.min(20, Number(searchParams.get("limit") ?? 12));

  if (!symbol) {
    // Piyasa geneli haber akışı
    const items = await getStockNews("BIST 100", "", limit);
    return NextResponse.json({ ...aggregateNews(items), source: "Google Haberler (RSS)", fetchedAt: Date.now() });
  }

  const meta = findStock(symbol);
  const items = await getStockNews(symbol, meta?.name ?? symbol, limit);
  return NextResponse.json({ ...aggregateNews(items), symbol, source: "Google Haberler (RSS)", fetchedAt: Date.now() });
}
