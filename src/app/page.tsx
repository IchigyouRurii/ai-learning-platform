import { redirect } from "next/navigation";
import { getSessionState } from "@/modules/platform";

export default async function HomePage() {
  const state = await getSessionState();
  if (state.status === "unavailable") redirect("/login?auth=unavailable");
  const user = state.user;
  redirect(
    !user
      ? "/login"
      : user.role === "teacher"
        ? "/teacher"
        : user.role === "admin"
          ? "/admin"
          : "/student",
  );
}
