import { TeacherTeachingManagement } from "@/modules/teacher/dashboard/screens/students";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TeacherTeachingManagement searchParams={await searchParams} />;
}
