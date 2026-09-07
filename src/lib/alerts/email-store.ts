/**
 * E-posta ayarları depolama adaptörü
 *
 * - Yerel/DB ortamında: SQLite (kalıcı)
 * - Serverless (Vercel) ortamında DB kullanılamazsa: /tmp JSON fallback (Lambda ömrü boyunca)
 *   Bu durumda site açıkken uyarılar her zaman çalışır (istemci kimlik bilgisiyle istek başına gönderir);
 *   zamanlanmış raporlar Lambda sıcak olduğu sürece çalışır — dürüst durum bilgisi döndürülür.
 */

import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";

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

const TMP_FILE = path.join("/tmp", "bist-email-settings.json");

async function readTmp(): Promise<EmailSettingsData | null> {
  try {
    const raw = await fs.readFile(TMP_FILE, "utf8");
    return JSON.parse(raw) as EmailSettingsData;
  } catch {
    return null;
  }
}

async function writeTmp(d: EmailSettingsData): Promise<void> {
  try {
    await fs.writeFile(TMP_FILE, JSON.stringify(d), "utf8");
  } catch {
    /* yoksay */
  }
}

export async function getEmailSettings(): Promise<EmailSettingsData | null> {
  try {
    const row = await db.emailSettings.findFirst();
    if (row) {
      return {
        email: row.email,
        appPasswordEnc: row.appPasswordEnc,
        lossAlert: row.lossAlert,
        lossThresholdPct: row.lossThresholdPct,
        profitAlert: row.profitAlert,
        profitTargetPct: row.profitTargetPct,
        dailyReport: row.dailyReport,
        positionsJson: row.positionsJson,
        totalCostSnapshot: row.totalCostSnapshot,
        lastReportDate: row.lastReportDate,
      };
    }
    return null;
  } catch {
    return readTmp();
  }
}

export async function setEmailSettings(d: EmailSettingsData): Promise<{ persistent: boolean }> {
  try {
    const existing = await db.emailSettings.findFirst();
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
    };
    if (existing) await db.emailSettings.update({ where: { id: existing.id }, data });
    else await db.emailSettings.create({ data });
    await writeTmp(d); // DB olan ortamda da yedek tut
    return { persistent: true };
  } catch {
    await writeTmp(d);
    return { persistent: false };
  }
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
  try {
    await db.emailSettings.deleteMany({});
  } catch {
    /* yoksay */
  }
  try {
    await fs.unlink(TMP_FILE);
  } catch {
    /* yoksay */
  }
}
