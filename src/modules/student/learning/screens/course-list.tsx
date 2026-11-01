import { getCurrentUser, getCourseCatalog } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { CourseCatalog } from "@/modules/platform/components/course-catalog";

/** Public metadata only; learning records and personal courses live in My Learning. */
export async function StudentCourseList() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const courses = await getCourseCatalog(user);
  return <CourseCatalog courses={courses} author={user} />;
}
