import { expect, it } from "vitest";
import { databaseConnectionSettings } from "@/shared/database/connection-settings";
it("keeps local PostgreSQL on TCP and enables WebSocket only for real Neon hostnames", () => {
  expect(
    databaseConnectionSettings({
      DATABASE_URL: "postgresql://test@localhost/db",
    }).transport,
  ).toBe("tcp");
  expect(
    databaseConnectionSettings({
      DATABASE_URL: "postgresql://test@ep-test.neon.tech/db",
    }).transport,
  ).toBe("websocket");
  expect(
    databaseConnectionSettings({
      DATABASE_URL: "postgresql://test@neon.tech.attacker.test/db",
    }).transport,
  ).toBe("tcp");
  expect(() =>
    databaseConnectionSettings({
      DATABASE_URL: "postgresql://test@localhost/db",
      DATABASE_TRANSPORT: "websocket",
    }),
  ).toThrow("Neon");
});
it("does not silently inherit a shell proxy or leak a secret through configuration errors", () => {
  const base = {
    DATABASE_URL: "postgresql://test:secret@ep-test.neon.tech/db",
    HTTPS_PROXY: "http://127.0.0.1:8890",
  };
  expect(databaseConnectionSettings(base).proxy).toBe("");
  expect(
    databaseConnectionSettings({
      ...base,
      DATABASE_PROXY_URL: "http://127.0.0.1:8890",
    }).proxy,
  ).toBe("http://127.0.0.1:8890");
  expect(() =>
    databaseConnectionSettings({ DATABASE_URL: "invalid-secret" }),
  ).toThrow("Invalid DATABASE_URL");
  expect(() =>
    databaseConnectionSettings({ ...base, DATABASE_TRANSPORT: "invalid" }),
  ).toThrow("DATABASE_TRANSPORT");
});
