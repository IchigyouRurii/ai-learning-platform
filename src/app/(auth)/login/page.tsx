import { redirect } from "next/navigation";
import { getSessionUser } from "@/modules/platform";
import { AuthForm } from "@/modules/platform/auth/auth-form";
import { getAppMode, isAuthConfigured } from "@/shared/config";

export default async function LoginPage() {
  if (getAppMode() === "demo" || (await getSessionUser())) redirect("/");
  return <AuthForm mode="login" configured={isAuthConfigured()} />;
}
