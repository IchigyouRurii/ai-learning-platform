import { AdminClassroomsScreen } from "@/modules/platform/admin/screens/classrooms";
import type { AdminSearchParams } from "@/modules/platform/admin/query";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  return <AdminClassroomsScreen searchParams={searchParams} />;
}
