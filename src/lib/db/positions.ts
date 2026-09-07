import { eq } from "drizzle-orm";
import { db } from "./client";
import { positions } from "./schema";
import type { NewPosition } from "./schema";

export async function getAllPositions() {
  return db.select().from(positions);
}

export async function getPosition(id: string) {
  const rows = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPositionBySymbol(symbol: string) {
  const rows = await db
    .select()
    .from(positions)
    .where(eq(positions.symbol, symbol.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPosition(data: NewPosition) {
  await db.insert(positions).values(data);
  return getPosition(data.id);
}

export async function updatePosition(id: string, data: Partial<NewPosition>) {
  await db.update(positions).set(data).where(eq(positions.id, id));
  return getPosition(id);
}

export async function deletePosition(id: string) {
  await db.delete(positions).where(eq(positions.id, id));
}
