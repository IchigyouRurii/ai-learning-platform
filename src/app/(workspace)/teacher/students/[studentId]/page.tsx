import { TeacherStudentDetail } from "@/modules/teacher/dashboard/screens/student-detail";

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { studentId } = await params;
  return (
    <TeacherStudentDetail
      studentId={studentId}
      searchParams={await searchParams}
    />
  );
}
