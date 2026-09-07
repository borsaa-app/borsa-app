import { eq, desc, sql } from "drizzle-orm";
import { db } from "./client";
import { analysisCache } from "./schema";

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export async function getCachedAnalysis(symbol: string) {
  const rows = await db
    .select()
    .from(analysisCache)
    .where(eq(analysisCache.symbol, symbol.toUpperCase()))
    .orderBy(desc(analysisCache.cachedAt))
    .limit(1);
  if (rows.length === 0) return null;

  const row = rows[0];
  const age = Date.now() - new Date(row.cachedAt).getTime();
  if (age > CACHE_TTL_MS) return null;

  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export async function setCachedAnalysis(symbol: string, data: unknown) {
  await db
    .delete(analysisCache)
    .where(eq(analysisCache.symbol, symbol.toUpperCase()));
  await db.insert(analysisCache).values({
    id: `analysis-${symbol.toUpperCase()}-${Date.now()}`,
    symbol: symbol.toUpperCase(),
    data: JSON.stringify(data),
    cachedAt: new Date(),
  });
}
