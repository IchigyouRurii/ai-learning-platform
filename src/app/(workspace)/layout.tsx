import { getCurrentUser } from "@/modules/platform";
import { AppShell } from "@/modules/platform/components/app-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell user={await getCurrentUser()}>{children}</AppShell>;
}
