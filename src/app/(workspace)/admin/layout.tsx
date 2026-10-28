import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/platform";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if ((await getCurrentUser()).role !== "admin") redirect("/");
  return children;
}
