import { redirect } from "next/navigation";
import { getSessionState } from "@/modules/platform";
import { AuthForm } from "@/modules/platform/auth/auth-form";
import { getAppMode, isAuthConfigured } from "@/shared/config";

export default async function RegisterPage() {
  if (getAppMode() === "demo") redirect("/");
  const state = await getSessionState();
  if (state.user) redirect("/");
  return (
    <AuthForm
      mode="register"
      configured={isAuthConfigured()}
      serviceUnavailable={state.status === "unavailable"}
    />
  );
}
