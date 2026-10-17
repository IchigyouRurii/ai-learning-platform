import { getCurrentUser } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { CourseBuilder } from "@/modules/teacher/course-builder/components/course-builder";
export default async function NewCoursePage() {
  if ((await getCurrentUser()).role !== "teacher")
    return <RoleGate expected="teacher" />;
  return (
    <>
      <PageHeading
        eyebrow="COURSE STUDIO"
        title="把你的知识，变成一段学习旅程。"
        description="提供目标与材料，生成草稿；审核、编辑后再让学生加入。"
      />
      <CourseBuilder />
    </>
  );
}
