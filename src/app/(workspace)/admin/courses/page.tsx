import { AdminCoursesScreen } from "@/modules/platform/admin/screens/courses";
import type { AdminSearchParams } from "@/modules/platform/admin/query";

export default function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  return <AdminCoursesScreen searchParams={searchParams} />;
}
