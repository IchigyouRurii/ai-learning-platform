import { StudentCourseDetail } from "@/modules/student/learning/screens/course-detail";
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  return (
    <StudentCourseDetail
      id={(await params).id}
      level={(await searchParams).level}
    />
  );
}
