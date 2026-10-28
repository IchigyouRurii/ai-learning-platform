import { StudentCourseDetail } from "@/modules/student/learning/screens/course-detail";
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const raw = (await searchParams).version;
  const version = raw === undefined ? undefined : Number(raw);
  if (version !== undefined && (!Number.isInteger(version) || version < 1))
    return <p>Invalid course version.</p>;
  return <StudentCourseDetail id={(await params).id} version={version} />;
}
