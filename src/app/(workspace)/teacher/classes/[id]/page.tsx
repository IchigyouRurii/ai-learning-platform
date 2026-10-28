import { TeacherClassDetail } from "@/modules/teacher/classes/screens/class-detail";
export default async function Page({
  searchParams,
  params,
}: {
  searchParams: Promise<{ cursor?: string }>;
  params: Promise<{ id: string }>;
}) {
  return (
    <TeacherClassDetail
      id={(await params).id}
      cursor={(await searchParams).cursor}
    />
  );
}
