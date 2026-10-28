import { AdminClassroomDetailScreen } from "@/modules/platform/admin/screens/classroom-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminClassroomDetailScreen id={(await params).id} />;
}
