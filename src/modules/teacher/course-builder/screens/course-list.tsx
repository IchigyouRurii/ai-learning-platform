import {
  getCurrentUser,
  getOwnedCourseCatalog,
  getCourseCatalog,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { CourseCatalog } from "@/modules/platform/components/course-catalog";

export type CatalogSearch = {
  q?: string | string[];
  subject?: string | string[];
};
export async function TeacherCourseList({
  creations = false,
}: {
  searchParams: Promise<CatalogSearch>;
  creations?: boolean;
}) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const courses = creations
    ? await getOwnedCourseCatalog(user)
    : await getCourseCatalog(user);
  return (
    <CourseCatalog courses={courses} author={user} creations={creations} />
  );
}
