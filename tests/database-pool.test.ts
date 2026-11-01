import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const created: Array<{
    options: unknown;
    ending: boolean;
    ended: boolean;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  }> = [];
  class FakePool {
    ending = false;
    ended = false;
    on = vi.fn(() => this);
    end = vi.fn(async () => {
      this.ending = true;
      this.ended = true;
    });
    constructor(public options: unknown) {
      created.push(this);
    }
  }
  return {
    created,
    tcp: vi.fn(function (options: unknown) {
      return new FakePool(options);
    }),
    ws: vi.fn(function (options: unknown) {
      return new FakePool(options);
    }),
    config: { webSocketConstructor: undefined as unknown },
  };
});
vi.mock("pg", () => ({ Pool: mocks.tcp }));
vi.mock("@neondatabase/serverless", () => ({
  Pool: mocks.ws,
  neonConfig: mocks.config,
}));
const runtime = globalThis as unknown as Record<string, unknown>;
const keys = [
  "minicoursePostgres",
  "minicoursePostgresSettings",
  "minicoursePostgresFactory",
];
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.created.length = 0;
  for (const key of keys) delete runtime[key];
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://test:secret@ep-test.example.neon.tech/neondb?sslmode=require",
  );
  vi.stubEnv("DATABASE_TRANSPORT", "auto");
  vi.stubEnv("DATABASE_PROXY_URL", "");
});
afterEach(() => {
  for (const key of keys) delete runtime[key];
  vi.unstubAllEnvs();
});
it("uses the Neon WebSocket pool with bounded connection waits and reuses a healthy singleton", async () => {
  const { getDatabasePool } = await import("@/shared/database/pool");
  const pool = getDatabasePool();
  expect(getDatabasePool()).toBe(pool);
  expect(mocks.ws).toHaveBeenCalledOnce();
  expect(mocks.tcp).not.toHaveBeenCalled();
  expect(mocks.created[0].options).toMatchObject({
    connectionTimeoutMillis: 5000,
    maxLifetimeSeconds: 60,
    max: 5,
  });
});
it("replaces a closed pool and a changed configuration without returning dead clients", async () => {
  const { getDatabasePool } = await import("@/shared/database/pool");
  const first = getDatabasePool();
  await first.end();
  const second = getDatabasePool();
  expect(second).not.toBe(first);
  vi.stubEnv("DATABASE_TRANSPORT", "tcp");
  const third = getDatabasePool();
  expect(third).not.toBe(second);
  expect(mocks.created[1].end).toHaveBeenCalledOnce();
  expect(mocks.tcp).toHaveBeenCalledOnce();
});
it("replaces legacy and hot-reloaded pools rather than pinning stale connections forever", async () => {
  const legacy = { end: vi.fn(async () => {}), ended: false, ending: false };
  runtime.minicoursePostgres = legacy;
  const first = (await import("@/shared/database/pool")).getDatabasePool();
  expect(first).not.toBe(legacy);
  expect(legacy.end).toHaveBeenCalledOnce();
  vi.resetModules();
  const second = (await import("@/shared/database/pool")).getDatabasePool();
  expect(second).not.toBe(first);
  expect(mocks.created[0].end).toHaveBeenCalledOnce();
});
it("does not silently choose a different transport when configuration is invalid", async () => {
  vi.stubEnv("DATABASE_PROXY_URL", "socks5://localhost:1080");
  const { getDatabasePool } = await import("@/shared/database/pool");
  expect(() => getDatabasePool()).toThrow("HTTP or HTTPS");
  expect(mocks.ws).not.toHaveBeenCalled();
  expect(mocks.tcp).not.toHaveBeenCalled();
});
