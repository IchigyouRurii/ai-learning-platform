import { AdminUsersScreen } from "@/modules/platform/admin/screens/users";
import type { AdminSearchParams } from "@/modules/platform/admin/query";

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  return <AdminUsersScreen searchParams={searchParams} />;
}
