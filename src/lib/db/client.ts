import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
    if (!tursoUrl) {
      throw new Error("TURSO_DATABASE_URL environment variable is required");
    }
    _client = createClient({ url: tursoUrl, authToken: tursoAuthToken });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export const db: LibSQLDatabase<typeof schema> = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
});
