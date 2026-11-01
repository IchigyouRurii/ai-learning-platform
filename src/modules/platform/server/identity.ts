import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@/shared/contracts";
import { getAppMode, isAuthConfigured } from "@/shared/config";
import { getAuth } from "./auth";
import { readSessionWithRetry } from "./session-read";

export const DEMO_USERS: Record<"teacher" | "student", User> = {
  teacher: { id: "demo-teacher", name: "Ethan Lin", role: "teacher" },
  student: { id: "demo-student", name: "Alex Lin", role: "student" },
};

export type SessionState =
  | { status: "authenticated"; user: User }
  | { status: "anonymous" | "unavailable"; user: null };

export const getSessionState = cache(async (): Promise<SessionState> => {
  if (getAppMode() === "demo") {
    const role = (await cookies()).get("demo-role")?.value;
    return {
      status: "authenticated",
      user: role === "student" ? DEMO_USERS.student : DEMO_USERS.teacher,
    };
  }
  if (!isAuthConfigured()) return { status: "anonymous", user: null };
  const cookieJar = await cookies();
  if (
    !cookieJar
      .getAll()
      .some(
        (cookie) =>
          cookie.name === "minicourse.session_token" ||
          cookie.name === "__Secure-minicourse.session_token",
      )
  )
    return { status: "anonymous", user: null };
  const requestHeaders = await headers();
  const result = await readSessionWithRetry(() =>
    getAuth().api.getSession({ headers: requestHeaders }),
  );
  if (!result.available) return { status: "unavailable", user: null };
  const session = result.session;
  if (!session) return { status: "anonymous", user: null };
  const role = session.user.role;
  if (role !== "teacher" && role !== "student" && role !== "admin")
    throw new Error("Invalid account role. Contact the project administrator.");
  return {
    status: "authenticated",
    user: { id: session.user.id, name: session.user.name, role },
  };
});

export const getSessionUser = cache(
  async (): Promise<User | null> => (await getSessionState()).user,
);

export async function getCurrentUser(): Promise<User> {
  const state = await getSessionState();
  if (state.status === "unavailable") redirect("/login?auth=unavailable");
  if (!state.user) redirect("/login");
  return state.user;
}
