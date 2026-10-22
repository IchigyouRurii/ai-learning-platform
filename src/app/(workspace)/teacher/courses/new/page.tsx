import { getCurrentUser } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { CourseGenerator } from "@/modules/course-generation/components/course-generator";

export default async function NewCoursePage() {
  if ((await getCurrentUser()).role !== "teacher")
    return <RoleGate expected="teacher" />;
  return (
    <>
      <PageHeading
        eyebrow="COURSE STUDIO"
        title="Create a course"
        description="Generate a draft from your goals and materials, then edit and publish it."
      />
      <CourseGenerator mode="teacher" />
    </>
  );
}
