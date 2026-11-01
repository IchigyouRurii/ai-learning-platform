import { databaseFailureCode as authenticationFailureCode } from "@/shared/database/diagnostics";
export { databaseFailureCode as authenticationFailureCode } from "@/shared/database/diagnostics";

function isSessionApiFailure(error: unknown, unauthorized: boolean): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  const body = value.body as { code?: unknown } | undefined;
  return (
    body?.code === "FAILED_TO_GET_SESSION" &&
    (unauthorized
      ? value.statusCode === 401 || value.status === "UNAUTHORIZED"
      : value.statusCode === 500 || value.status === "INTERNAL_SERVER_ERROR")
  );
}

/** Retry one session read, never replay registration/sign-in or grant a fallback identity. */
export async function readSessionWithRetry<T>(
  read: () => Promise<T | null>,
): Promise<
  { available: true; session: T | null } | { available: false; session: null }
> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { available: true, session: await read() };
    } catch (error) {
      if (isSessionApiFailure(error, true))
        return { available: true, session: null };
      const code = authenticationFailureCode(error);
      if (!code && !isSessionApiFailure(error, false)) throw error;
      // Configuration/schema failures cannot recover on a second read.
      if (
        attempt === 1 ||
        code === "42P01" ||
        code === "42703" ||
        code === "28P01" ||
        code === "28000"
      )
        return { available: false, session: null };
    }
  }
  return { available: false, session: null };
}
