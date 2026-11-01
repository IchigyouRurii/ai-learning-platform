import { redirect } from "next/navigation";
import { getSessionState } from "@/modules/platform";
import { AuthForm } from "@/modules/platform/auth/auth-form";
import { getAppMode, isAuthConfigured } from "@/shared/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string | string[] }>;
}) {
  if (getAppMode() === "demo") redirect("/");
  // The protected page already tried twice. Render recovery immediately instead
  // of retrying again during the redirect or throwing another server overlay.
  if ((await searchParams).auth === "unavailable")
    return (
      <AuthForm
        mode="login"
        configured={isAuthConfigured()}
        serviceUnavailable
      />
    );
  const state = await getSessionState();
  if (state.user) redirect("/");
  return (
    <AuthForm
      mode="login"
      configured={isAuthConfigured()}
      serviceUnavailable={state.status === "unavailable"}
    />
  );
}
