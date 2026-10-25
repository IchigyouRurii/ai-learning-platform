import {
  getCurrentUser,
  getLearningPath,
  getWorkspace,
  listLearningPaths,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { LearningPathPlanner } from "../components/planner";

export async function StudentLearningPath() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const [workspace, savedPath, pathHistory] = await Promise.all([
    getWorkspace(user),
    getLearningPath(user),
    listLearningPaths(user),
  ]);
  const courses = workspace.courses
    .filter(
      (course) => course.status === "published" && course.visibility === "cohort",
    )
    .map((course) => ({
      id: course.id,
      version: course.version,
      title: course.title,
      subject: course.subject,
      description: course.description,
      lessons: course.lessons,
    }));
  return (
    <>
      <PageHeading
        eyebrow="PERSONAL LEARNING PATH"
        title="A route built around your goal."
        description="AI orders published micro-courses by difficulty and your available time. You can save the plan and follow it at your own pace."
      />
      <LearningPathPlanner
        courses={courses}
        savedPath={savedPath}
        history={pathHistory}
      />
    </>
  );
}
