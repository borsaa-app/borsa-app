import { eq, desc } from "drizzle-orm";
import { db } from "./client";
import { dailyPicks } from "./schema";

export async function getCachedPicks(date: string) {
  const rows = await db
    .select()
    .from(dailyPicks)
    .where(eq(dailyPicks.date, date))
    .orderBy(desc(dailyPicks.createdAt))
    .limit(1);
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].data);
  } catch {
    return null;
  }
}

export async function setCachedPicks(date: string, data: unknown) {
  await db.delete(dailyPicks).where(eq(dailyPicks.date, date));
  await db.insert(dailyPicks).values({
    id: `picks-${date}-${Date.now()}`,
    date,
    data: JSON.stringify(data),
  });
}
