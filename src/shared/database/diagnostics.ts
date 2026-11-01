/** Safe classification only: never include upstream messages, cookies, SQL or credentials. */
export function databaseFailureCode(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== "object" || depth > 4) return null;
  const value = error as Record<string, unknown>;
  if (
    typeof value.code === "string" &&
    /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|080\w\w|53300|57P0[123]|28P01|28000|42P01|42703)$/.test(
      value.code,
    )
  )
    return value.code;
  if (value.cause) {
    const code = databaseFailureCode(value.cause, depth + 1);
    if (code) return code;
  }
  if (Array.isArray(value.errors)) {
    for (const nested of value.errors) {
      const code = databaseFailureCode(nested, depth + 1);
      if (code) return code;
    }
  }
  if (
    error instanceof Error &&
    /(?:websocket.*(?:closed|failed|error)|opening handshake|all attempts to open a websocket)/i.test(
      error.message,
    )
  )
    return "WEBSOCKET_UNAVAILABLE";
  if (
    error instanceof Error &&
    /timeout|timed out|connection (?:terminated|closed)|socket hang up/i.test(
      error.message,
    )
  )
    return "CONNECTION_TIMEOUT";
  return null;
}

/** User-facing CLI text is static, so upstream errors cannot leak a connection string. */
export function databaseFailureDiagnostic(error: unknown): {
  code: string;
  hint: string;
} {
  const code = databaseFailureCode(error) ?? "UNKNOWN";
  const hints: Record<string, string> = {
    WEBSOCKET_UNAVAILABLE:
      "The database WebSocket connection failed. Check the network and DATABASE_PROXY_URL; keep the configured local proxy running.",
    CONNECTION_TIMEOUT:
      "Connection timed out. Check local network access to Neon; this does not prove the database has crashed.",
    ETIMEDOUT: "Connection timed out. Check local network access to Neon.",
    ECONNRESET:
      "The database connection was interrupted. Retry and check network stability.",
    ECONNREFUSED:
      "The database endpoint refused the connection. Check the endpoint and compute status.",
    ENOTFOUND:
      "The database hostname could not be resolved. Check DATABASE_URL and DNS.",
    EAI_AGAIN: "DNS lookup temporarily failed. Retry or check your network.",
    "28P01":
      "Database password authentication failed. Verify the database role and connection string.",
    "28000":
      "The database role is not authorized. Check its access configuration.",
    "42P01":
      "A required table is missing. Confirm the selected branch/database before considering migrations.",
    "42703":
      "A required column is missing. Confirm the branch and migration state.",
    "53300":
      "The database connection limit was reached. Check active connections and pooling.",
    "57P03":
      "The database is not accepting connections yet. Check its compute status and retry.",
  };
  return {
    code,
    hint:
      hints[code] ??
      "Check the local connection configuration, network, and database status. Upstream details are hidden.",
  };
}
