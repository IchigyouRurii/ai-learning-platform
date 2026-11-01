import { Pool } from "pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import { databaseConnectionSettings } from "./connection-settings";

const runtime = globalThis as typeof globalThis & {
  minicoursePostgres?: Pool;
  minicoursePostgresSettings?: string;
  minicoursePostgresFactory?: typeof createDatabasePool;
};

function createDatabasePool(
  settings: ReturnType<typeof databaseConnectionSettings>,
): Pool {
  const options = {
    connectionString: settings.connectionString,
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
    maxLifetimeSeconds: 60,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
  if (settings.transport === "tcp") return new Pool(options);
  // No HTTP SQL substitution: interactive transactions retain one pinned client.
  // Use an explicit per-database proxy; shell HTTP_PROXY is not silently applied.
  const agent = settings.proxy
    ? new HttpsProxyAgent(settings.proxy)
    : undefined;
  neonConfig.webSocketConstructor = class DatabaseWebSocket extends WebSocket {
    constructor(address: string, protocols?: string | string[]) {
      super(address, protocols, { agent, handshakeTimeout: 5000 });
    }
  };
  return new NeonPool(options) as unknown as Pool;
}

export function getDatabasePool(): Pool {
  const settings = databaseConnectionSettings();
  // Contains credentials in process memory only, exactly as the pool itself does.
  const key = JSON.stringify(settings);
  const previous = runtime.minicoursePostgres;
  if (
    previous &&
    !previous.ending &&
    !previous.ended &&
    runtime.minicoursePostgresSettings === key &&
    runtime.minicoursePostgresFactory === createDatabasePool
  )
    return previous;
  const pool = createDatabasePool(settings);
  pool.on("error", () =>
    console.warn(
      "Database connection interrupted; the failed idle connection was discarded.",
    ),
  );
  runtime.minicoursePostgres = pool;
  runtime.minicoursePostgresSettings = key;
  runtime.minicoursePostgresFactory = createDatabasePool;
  if (previous && !previous.ending && !previous.ended)
    void previous.end().catch(() => {});
  return pool;
}
