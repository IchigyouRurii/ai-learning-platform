import { PublishedCourseDetail } from "@/modules/teacher/course-builder/screens/published-course-detail";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  return (
    <PublishedCourseDetail
      id={(await params).id}
      level={(await searchParams).level}
    />
  );
}
