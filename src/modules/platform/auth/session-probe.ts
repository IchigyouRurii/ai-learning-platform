import { z } from "zod";
const sessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    role: z.enum(["teacher", "student", "admin"]),
  }),
});
/** Probe only the cookie-authenticated server endpoint; never invent a local identity. */
export async function probeExistingSession(
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<"authenticated" | "anonymous" | "unavailable"> {
  try {
    const response = await request("/api/auth/get-session", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (!response.ok) return "unavailable";
    const value: unknown = await response.json();
    if (value === null) return "anonymous";
    return sessionSchema.safeParse(value).success
      ? "authenticated"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}
