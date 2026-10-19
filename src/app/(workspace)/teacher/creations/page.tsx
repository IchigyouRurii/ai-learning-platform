import {
  TeacherCourseList,
  type CatalogSearch,
} from "@/modules/teacher/course-builder/screens/course-list";
export default function MyCreations({
  searchParams,
}: {
  searchParams: Promise<CatalogSearch>;
}) {
  return <TeacherCourseList searchParams={searchParams} creations />;
}
