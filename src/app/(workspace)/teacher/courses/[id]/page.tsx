import { TeacherCourseDetail } from "@/modules/teacher/course-builder/screens/course-detail";
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  return (
    <TeacherCourseDetail
      id={(await params).id}
      level={(await searchParams).level}
    />
  );
}
