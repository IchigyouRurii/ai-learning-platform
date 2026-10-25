import {
  getCurrentUser,
  listGenerationRecords,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { CourseGenerator } from "@/modules/course-generation/components/course-generator";

export default async function StudentStudioPage() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const history = await listGenerationRecords(user, {
    kind: "course",
    limit: 10,
  });
  return (
    <>
      <PageHeading
        eyebrow="PERSONAL AI STUDIO"
        title="Learn anything, your way."
        description="Describe what you want to learn. AI builds a short course with a quiz that only you can see."
      />
      <CourseGenerator mode="student" history={history} />
    </>
  );
}
