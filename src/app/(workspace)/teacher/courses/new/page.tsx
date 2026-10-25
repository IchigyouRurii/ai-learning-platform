import {
  getCurrentUser,
  listGenerationRecords,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { CourseGenerator } from "@/modules/course-generation/components/course-generator";

export default async function NewCoursePage() {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const history = await listGenerationRecords(user, {
    kind: "course",
    limit: 10,
  });
  return (
    <>
      <PageHeading
        eyebrow="COURSE STUDIO"
        title="Create a course"
        description="Generate a draft from your goals and materials, then edit and publish it."
      />
      <CourseGenerator mode="teacher" history={history} />
    </>
  );
}
