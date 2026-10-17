import { redirect } from "next/navigation";
import { getSessionUser } from "@/modules/platform";

export default async function HomePage() {
  const user = await getSessionUser();
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
