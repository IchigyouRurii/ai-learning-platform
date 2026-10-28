import {
  TeacherCourseList,
  type CatalogSearch,
} from "@/modules/teacher/course-builder/screens/course-list";

export default function TeacherMarketplace({
  searchParams,
}: {
  searchParams: Promise<CatalogSearch>;
}) {
  return <TeacherCourseList searchParams={searchParams} />;
}
