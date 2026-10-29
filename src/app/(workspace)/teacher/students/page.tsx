import { TeacherStudents } from "@/modules/teacher/dashboard/screens/students";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;
  return <TeacherStudents courseId={courseId} />;
}
