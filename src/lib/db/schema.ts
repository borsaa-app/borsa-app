import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const emailSettings = sqliteTable("email_settings", {
  id: text("id").primaryKey().default("default"),
  email: text("email").notNull(),
  appPasswordEnc: text("app_password_enc").notNull(),
  lossAlert: integer("loss_alert", { mode: "boolean" }).notNull().default(true),
  lossThresholdPct: real("loss_threshold_pct").notNull().default(5),
  profitAlert: integer("profit_alert", { mode: "boolean" }).notNull().default(true),
  profitTargetPct: real("profit_target_pct").notNull().default(5),
  dailyReport: integer("daily_report", { mode: "boolean" }).notNull().default(true),
  positionsJson: text("positions_json"),
  totalCostSnapshot: real("total_cost_snapshot"),
  lastReportDate: text("last_report_date"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull(),
  avgCost: real("avg_cost").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  notes: text("notes"),
});

export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  positionId: text("position_id").notNull(),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(), // "ALIM" | "SATIM"
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  reason: text("reason"),
});

export const alertLog = sqliteTable("alert_log", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  dropAlertPct: real("drop_alert_pct").notNull().default(5),
  riseAlertPct: real("rise_alert_pct").notNull().default(5),
  targetAlertPct: real("target_alert_pct").notNull().default(10),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(30),
  pollingSeconds: integer("polling_seconds").notNull().default(60),
  emailTo: text("email_to").notNull().default(""),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(false),
  browserNotify: integer("browser_notify", { mode: "boolean" }).notNull().default(true),
  soundNotify: integer("sound_notify", { mode: "boolean" }).notNull().default(false),
  minInvestment: real("min_investment").notNull().default(100),
});

export const dailyPicks = sqliteTable("daily_picks", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  data: text("data").notNull(), // JSON string
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const analysisCache = sqliteTable("analysis_cache", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  data: text("data").notNull(), // JSON string
  cachedAt: integer("cached_at", { mode: "timestamp_ms" }).notNull(),
});

export type EmailSettings = typeof emailSettings.$inferSelect;
export type NewEmailSettings = typeof emailSettings.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type AlertLogEntry = typeof alertLog.$inferSelect;
export type NewAlertLogEntry = typeof alertLog.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type DailyPick = typeof dailyPicks.$inferSelect;
export type AnalysisCacheEntry = typeof analysisCache.$inferSelect;
