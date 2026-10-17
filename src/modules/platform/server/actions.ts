"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppMode } from "@/shared/config";

export async function switchDemoRole(formData: FormData) {
  if (getAppMode() !== "demo") throw new Error("演示身份切换已禁用。");
  const role = formData.get("role");
  if (role !== "teacher" && role !== "student")
    throw new Error("不支持的演示身份。");
  (await cookies()).set("demo-role", role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DEMO_HTTPS === "true",
  });
  redirect(role === "teacher" ? "/teacher" : "/student");
}
