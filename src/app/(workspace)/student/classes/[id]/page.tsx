import { StudentClassDetail } from "@/modules/student/classes/screens/class-detail";
export default async function Page({
  searchParams,
  params,
}: {
  searchParams: Promise<{ cursor?: string }>;
  params: Promise<{ id: string }>;
}) {
  return (
    <StudentClassDetail
      id={(await params).id}
      cursor={(await searchParams).cursor}
    />
  );
}
