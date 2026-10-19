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
        title="Create a course"
        description="Generate a draft from your goals and materials. Review and edit before publishing."
      />
      <CourseBuilder />
    </>
  );
}
