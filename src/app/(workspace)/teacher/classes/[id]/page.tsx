import { TeacherClassDetail } from "@/modules/teacher/classrooms/screens/class-detail";

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return (
    <TeacherClassDetail
      id={id}
      query={typeof search.q === "string" ? search.q : ""}
    />
  );
}
