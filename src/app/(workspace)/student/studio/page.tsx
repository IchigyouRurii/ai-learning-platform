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
        description="Bring your ideas to life with your own creative courses. Save them to explore in My Learning."
      />
      <CourseGenerator mode="student" history={history} />
    </>
  );
}
