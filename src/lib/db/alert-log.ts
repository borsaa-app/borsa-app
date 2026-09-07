import { eq, desc, sql } from "drizzle-orm";
import { db } from "./client";
import { alertLog } from "./schema";
import type { NewAlertLogEntry } from "./schema";

const MAX_ALERTS = 100;

export async function getAllAlerts() {
  return db.select().from(alertLog).orderBy(desc(alertLog.at)).limit(MAX_ALERTS);
}

export async function createAlert(data: NewAlertLogEntry) {
  await db.insert(alertLog).values(data);

  const count = await db.select({ count: sql<number>`count(*)` }).from(alertLog);
  const total = count[0]?.count ?? 0;
  if (total > MAX_ALERTS) {
    const oldest = await db
      .select({ id: alertLog.id })
      .from(alertLog)
      .orderBy(alertLog.at)
      .limit(total - MAX_ALERTS);
    if (oldest.length > 0) {
      const ids = oldest.map((r) => r.id);
      await db.delete(alertLog).where(sql`${alertLog.id} IN ${ids}`);
    }
  }
}

export async function markAllAsRead() {
  await db.update(alertLog).set({ read: true }).where(eq(alertLog.read, false));
}

export async function clearAlerts() {
  await db.delete(alertLog);
}
