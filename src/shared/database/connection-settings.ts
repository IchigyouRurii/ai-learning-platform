/** Server-side configuration only. Never log or send these values to a client. */
export function databaseConnectionSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("Set DATABASE_URL in the root .env first.");
  let url: URL;
  try {
    url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(
      "Invalid DATABASE_URL. Copy the PostgreSQL connection string from Neon Connect.",
    );
  }
  const neon = url.hostname.endsWith(".neon.tech");
  const requested = env.DATABASE_TRANSPORT?.trim() || "auto";
  if (!["auto", "tcp", "websocket"].includes(requested))
    throw new Error("DATABASE_TRANSPORT must be auto, tcp, or websocket.");
  const transport =
    requested === "auto" ? (neon ? "websocket" : "tcp") : requested;
  if (transport === "websocket" && !neon)
    throw new Error("WebSocket transport requires a Neon database hostname.");
  const proxy = env.DATABASE_PROXY_URL?.trim() || "";
  if (proxy) {
    try {
      const parsed = new URL(proxy);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(
        "DATABASE_PROXY_URL must be a valid HTTP or HTTPS proxy URL.",
      );
    }
    if (transport !== "websocket")
      throw new Error(
        "DATABASE_PROXY_URL requires WebSocket database transport.",
      );
  }
  return {
    connectionString,
    transport: transport as "tcp" | "websocket",
    proxy,
  };
}
