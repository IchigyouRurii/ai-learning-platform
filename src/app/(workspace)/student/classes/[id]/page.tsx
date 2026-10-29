import { StudentClassDetail } from "@/modules/student/classrooms/screens/class-detail";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <StudentClassDetail id={(await params).id} />;
}
