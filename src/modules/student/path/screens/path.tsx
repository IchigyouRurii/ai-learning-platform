import {
  getCurrentUser,
  getWorkspace,
  getLearningPath,
  listLearningPaths,
  getCourseCatalog,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading } from "@/shared/ui/primitives";
import { COURSE_LEVELS, lessonsAtLevel } from "@/shared/contracts";
import { LearningPathPlanner } from "../components/planner";

export async function StudentLearningPath() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const [workspace, history, catalog] = await Promise.all([
    getWorkspace(user),
    listLearningPaths(user),
    getCourseCatalog(user),
  ]);
  const savedPath = history[0] ?? (await getLearningPath(user));
  const publicIds = new Set(catalog.map((course) => course.id));
  const courses = workspace.courses
    .filter((course) => publicIds.has(course.id))
    .map((course) => ({
      id: course.id,
      version: course.version,
      title: course.title,
      subject: course.subject,
      description: course.description,
      levels: COURSE_LEVELS.filter(
        (level) => lessonsAtLevel(course.lessons, level).length > 0,
      ),
    }));
  return (
    <>
      <PageHeading
        eyebrow="PERSONAL LEARNING PATH"
        title="My Learning Paths"
        description="Connect courses into a route that works for you. Create a path, choose your levels, and start learning."
      />
      <LearningPathPlanner
        courses={courses}
        savedPath={savedPath}
        history={history}
        enrollments={workspace.enrollments.filter(
          (item) => item.studentId === user.id,
        )}
      />
    </>
  );
}
