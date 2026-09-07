/**
 * E-posta ayarları depolama adaptörü
 *
 * Turso (libSQL) veritabanına Drizzle ORM ile yazılır.
 */

import {
  getEmailSettings as dbGet,
  setEmailSettings as dbSet,
  updateEmailSettings as dbUpdate,
  deleteEmailSettings as dbDelete,
  type EmailSettingsData,
} from "@/lib/db/email-settings";

export type { EmailSettingsData };

export async function getEmailSettings(): Promise<EmailSettingsData | null> {
  return dbGet();
}

export async function setEmailSettings(d: EmailSettingsData): Promise<{ persistent: boolean }> {
  return dbSet(d);
}

export async function updateEmailSettings(patch: Partial<EmailSettingsData>): Promise<void> {
  return dbUpdate(patch);
}

export async function deleteEmailSettings(): Promise<void> {
  return dbDelete();
}
