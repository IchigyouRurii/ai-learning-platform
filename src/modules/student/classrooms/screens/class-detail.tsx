import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { Button } from "@/shared/ui/components/button";
import { Badge, PageHeading, ProgressBar } from "@/shared/ui/primitives";

export async function StudentClassDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const [classroomResult, workspace] = await Promise.all([
    platformExtensions.classrooms.get(user, { classId: id }),
    getWorkspace(user),
  ]);
  if (!classroomResult.ok) {
    if (classroomResult.code === "NOT_FOUND") notFound();
    return (
      <>
        <PageHeading
          eyebrow="MY CLASS"
          title="Class unavailable"
          description="The class could not be loaded."
        />
        <p className="error-text" role="alert">
          {classroomResult.error}
        </p>
      </>
    );
  }
  const classroom = classroomResult.data;
  const course = workspace.courses.find(
    (item) => item.id === classroom.courseId,
  );
  const progress = course
    ? calculateProgress(course, workspace.submissions, user.id)
    : null;
  return (
    <>
      <Link href="/student/classes" className="back-link">
        <ArrowLeft size={15} />
        Back to My Classes
      </Link>
      <PageHeading
        eyebrow="MY CLASS"
        title={classroom.name}
        description={
          classroom.description || "Your class details and progress."
        }
        action={
          <Badge>
            {classroom.memberCount}{" "}
            {classroom.memberCount === 1 ? "student" : "students"}
          </Badge>
        }
      />
      <p className="form-hint">
        Course:{" "}
        <Link href={`/student/courses/${classroom.courseId}`}>
          {classroom.courseTitle}
        </Link>
      </p>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>My completion</h2>
              <p className="muted">
                Completion records activity submissions in this class&apos;s
                course, not mastery.
              </p>
            </div>
          </div>
          {progress ? (
            <>
              <ProgressBar percent={progress.percent} />
              <p className="muted">
                {progress.done} / {progress.total} activities submitted ·{" "}
                {progress.percent}%
              </p>
              <p className="form-hint">
                Updated automatically as you submit activities.
              </p>
            </>
          ) : (
            <p className="muted">
              The course for this class is not available to your account yet.
              Ask your teacher to check the class.
            </p>
          )}
        </section>
        <aside className="panel">
          <h2>Class details</h2>
          <div className="grid gap-3">
            <div>
              <p className="form-hint">Course</p>
              <p className="inline-flex items-center gap-1">
                <BookOpen size={14} />
                {classroom.courseTitle}
              </p>
            </div>
            <div>
              <p className="form-hint">Class created</p>
              <p>
                {new Date(classroom.createdAt).toLocaleDateString("en-US", {
                  timeZone: "Asia/Shanghai",
                })}
              </p>
            </div>
            <div>
              <p className="form-hint">Class size</p>
              <p>
                {classroom.memberCount}{" "}
                {classroom.memberCount === 1 ? "student" : "students"}
              </p>
            </div>
          </div>
          {course && (
            <Button asChild>
              <Link href={`/student/courses/${classroom.courseId}`}>
                Open course
              </Link>
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
