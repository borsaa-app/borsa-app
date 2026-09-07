import { eq } from "drizzle-orm";
import { db } from "./client";
import { settings } from "./schema";
import type { NewSettings } from "./schema";

const DEFAULT_SETTINGS: NewSettings = {
  id: "default",
  dropAlertPct: 5,
  riseAlertPct: 5,
  targetAlertPct: 10,
  cooldownMinutes: 30,
  pollingSeconds: 60,
  emailTo: "",
  emailEnabled: false,
  browserNotify: true,
  soundNotify: false,
  minInvestment: 100,
};

export async function getSettings() {
  const rows = await db.select().from(settings).limit(1);
  if (rows.length === 0) return DEFAULT_SETTINGS;
  return rows[0];
}

export async function updateSettings(data: Partial<NewSettings>) {
  const existing = await db.select().from(settings).limit(1);
  if (existing.length > 0) {
    await db.update(settings).set(data).where(eq(settings.id, "default"));
  } else {
    await db.insert(settings).values({ ...DEFAULT_SETTINGS, ...data });
  }
}
