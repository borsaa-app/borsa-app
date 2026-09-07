import { eq } from "drizzle-orm";
import { db } from "./client";
import { emailSettings } from "./schema";

export interface EmailSettingsData {
  email: string;
  appPasswordEnc: string;
  lossAlert: boolean;
  lossThresholdPct: number;
  profitAlert: boolean;
  profitTargetPct: number;
  dailyReport: boolean;
  positionsJson?: string | null;
  totalCostSnapshot?: number | null;
  lastReportDate?: string | null;
}

export async function getEmailSettings(): Promise<EmailSettingsData | null> {
  const row = await db.select().from(emailSettings).limit(1);
  if (row.length === 0) return null;
  const r = row[0];
  return {
    email: r.email,
    appPasswordEnc: r.appPasswordEnc,
    lossAlert: r.lossAlert,
    lossThresholdPct: r.lossThresholdPct,
    profitAlert: r.profitAlert,
    profitTargetPct: r.profitTargetPct,
    dailyReport: r.dailyReport,
    positionsJson: r.positionsJson,
    totalCostSnapshot: r.totalCostSnapshot,
    lastReportDate: r.lastReportDate,
  };
}

export async function setEmailSettings(d: EmailSettingsData): Promise<{ persistent: boolean }> {
  const existing = await db.select().from(emailSettings).limit(1);
  const now = new Date().toISOString();
  const data = {
    email: d.email,
    appPasswordEnc: d.appPasswordEnc,
    lossAlert: d.lossAlert,
    lossThresholdPct: d.lossThresholdPct,
    profitAlert: d.profitAlert,
    profitTargetPct: d.profitTargetPct,
    dailyReport: d.dailyReport,
    positionsJson: d.positionsJson ?? null,
    totalCostSnapshot: d.totalCostSnapshot ?? null,
    lastReportDate: d.lastReportDate ?? null,
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db.update(emailSettings).set(data).where(eq(emailSettings.id, existing[0].id));
  } else {
    await db.insert(emailSettings).values({ id: "default", ...data });
  }
  return { persistent: true };
}

export async function updateEmailSettings(patch: Partial<EmailSettingsData>): Promise<void> {
  const cur = (await getEmailSettings()) ?? {
    email: "",
    appPasswordEnc: "",
    lossAlert: true,
    lossThresholdPct: 5,
    profitAlert: true,
    profitTargetPct: 5,
    dailyReport: true,
  };
  await setEmailSettings({ ...cur, ...patch });
}

export async function deleteEmailSettings(): Promise<void> {
  await db.delete(emailSettings);
}
