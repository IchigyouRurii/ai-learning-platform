import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@/shared/contracts";
import { getAppMode, isAuthConfigured } from "@/shared/config";
import { getAuth } from "./auth";

export const DEMO_USERS: Record<"teacher" | "student", User> = {
  teacher: { id: "demo-teacher", name: "林老师", role: "teacher" },
  student: { id: "demo-student", name: "小林", role: "student" },
};

export const getSessionUser = cache(async (): Promise<User | null> => {
  if (getAppMode() === "demo") {
    const role = (await cookies()).get("demo-role")?.value;
    return role === "student" ? DEMO_USERS.student : DEMO_USERS.teacher;
  }
  if (!isAuthConfigured()) return null;
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
    return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = session.user.role;
  if (role !== "teacher" && role !== "student" && role !== "admin")
    throw new Error("账号身份无效，请联系项目管理员。");
  return { id: session.user.id, name: session.user.name, role };
});

export async function getCurrentUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
