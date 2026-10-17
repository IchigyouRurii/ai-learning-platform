import { TeacherCourseDetail } from "@/modules/teacher/course-builder/screens/course-detail";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TeacherCourseDetail id={(await params).id} />;
}
