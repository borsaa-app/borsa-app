import { eq, desc } from "drizzle-orm";
import { db } from "./client";
import { trades } from "./schema";
import type { NewTrade } from "./schema";

export async function getAllTrades() {
  return db.select().from(trades).orderBy(desc(trades.at));
}

export async function getTradesBySymbol(symbol: string) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.symbol, symbol.toUpperCase()))
    .orderBy(desc(trades.at));
}

export async function createTrade(data: NewTrade) {
  await db.insert(trades).values(data);
}
