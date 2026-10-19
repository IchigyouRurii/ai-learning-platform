import { betterAuth } from "better-auth";
import type { Pool } from "pg";

// Shared by the server and migration CLI. No credentials or configuration are
// imported by browser components; create the instance lazily on the server.
export function createAuth(
  database: Pool,
  configuration = {
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    baseURL: process.env.BETTER_AUTH_URL ?? "",
  },
) {
  if (configuration.secret.length < 32)
    throw new Error(
      "BETTER_AUTH_SECRET requires at least 32 random characters.",
    );
  const base = new URL(configuration.baseURL);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  )
    throw new Error("Production authentication URLs must use HTTPS.");
  const origins = [base.origin];
  if (
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(base.hostname)
  ) {
    const alternate = new URL(base.origin);
    alternate.hostname =
      base.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(alternate.origin);
  }
  return betterAuth({
    appName: "OpenLearnING",
    database,
    secret: configuration.secret,
    baseURL: configuration.baseURL,
    trustedOrigins: origins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: {
          type: ["student", "teacher", "admin"],
          defaultValue: "student",
          input: false,
          required: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "minicourse",
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: () => crypto.randomUUID() },
    },
    logger: {
      level: "error",
      log: () =>
        console.error(
          "Authentication error. Check the connection and database initialization.",
        ),
    },
  });
}
