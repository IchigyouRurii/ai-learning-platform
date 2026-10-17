import { StudentCourseDetail } from "@/modules/student/learning/screens/course-detail";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <StudentCourseDetail id={(await params).id} />;
}
