export function getAppMode(): "demo" | "neon" {
  const mode = process.env.APP_MODE ?? "neon";
  if (mode !== "demo" && mode !== "neon")
    throw new Error("APP_MODE must be demo or neon.");
  return mode;
}

export function isAuthConfigured() {
  return Boolean(
    process.env.DATABASE_URL?.trim() &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_SECRET.length >= 32 &&
    process.env.BETTER_AUTH_URL?.trim(),
  );
}
