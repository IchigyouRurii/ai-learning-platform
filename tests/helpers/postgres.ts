import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";

// Real PostgreSQL compiled to WebAssembly, only for integration tests. Production
// always uses node-postgres against DATABASE_URL; this is not a runtime fallback.
export async function createTestPostgres() {
  const database = new PGlite();
  await database.waitReady;
  const client = {
    async query(
      source: string | { text: string; values?: unknown[] },
      parameters?: unknown[],
    ) {
      const text = typeof source === "string" ? source : source.text;
      const values =
        parameters ?? (typeof source === "string" ? [] : (source.values ?? []));
      const result = await database.query(text, values);
      return {
        rows: result.rows,
        fields: result.fields,
        rowCount: result.affectedRows || result.rows.length,
        command: text.trim().split(/\s+/)[0].toUpperCase(),
        oid: 0,
      };
    },
    release() {},
  };
  const pool = {
    ...client,
    connect: async () => client,
    end: async () => database.close(),
    on() {
      return this;
    },
  } as unknown as Pool;
  return { database, pool };
}
