import Link from "next/link";
import { BookOpen, CheckCheck, Compass } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getLearningPath,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { CourseCard, PageHeading, StatCard } from "@/shared/ui/primitives";

export async function StudentCourseList() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const savedPath = await getLearningPath(user);
  const enrolled = new Set(workspace.enrollments.map((item) => item.courseId));
  const personal = workspace.courses.filter(
    (course) =>
      course.visibility === "personal" && course.ownerId === user.id,
  );
  const catalog = workspace.courses.filter(
    (course) => course.visibility !== "personal",
  );
  const completed = workspace.courses.filter(
    (course) =>
      enrolled.has(course.id) &&
      calculateProgress(course, workspace.submissions, user.id).percent === 100,
  ).length;
  return (
    <>
      <PageHeading
        eyebrow="YOUR LEARNING SPACE"
        title="Start your next discovery."
        description="Learn at your own pace through short lessons and practical activities."
      />
      <section className="student-banner">
        <div>
          <span className="eyebrow">SMALL LESSONS. REAL PROGRESS.</span>
          <h2>
            One step at a time.
            <br />
            Start with a small task.
          </h2>
          <p>Choose a topic, try an activity, and learn from feedback.</p>
        </div>
        <Compass size={116} strokeWidth={0.65} aria-hidden="true" />
      </section>
      <section className="stats-grid">
        <StatCard
          label="Enrolled courses"
          value={enrolled.size}
          detail="Learn at your own pace"
          icon={<BookOpen size={17} />}
        />
        <StatCard
          label="Completed courses"
          value={completed}
          detail="Based on submitted activities"
          icon={<CheckCheck size={17} />}
        />
        <StatCard
          label="Available courses"
          value={workspace.courses.length}
          detail="Explore software development and AI collaboration"
          icon={<Compass size={17} />}
        />
      </section>
      {savedPath && (
        <section className="panel path-summary">
          <div>
            <p className="eyebrow">YOUR LEARNING PATH</p>
            <h2>{savedPath.title}</h2>
            <p className="muted">
              {savedPath.steps.length} courses · saved for you
            </p>
          </div>
          <div className="path-summary-steps">
            {savedPath.steps.slice(0, 3).map((step, index) => {
              const course = workspace.courses.find(
                (item) => item.id === step.courseId,
              );
              return (
                <Link
                  key={step.courseId}
                  href={`/student/courses/${step.courseId}`}
                  className="path-summary-step"
                >
                  <span className="path-order">{index + 1}</span>
                  <span>{course?.title ?? step.courseId}</span>
                </Link>
              );
            })}
            <Link href="/student/path" className="text-link">
              View and update my path →
            </Link>
          </div>
        </section>
      )}
      {personal.length > 0 && (
        <>
          <div className="section-heading">
            <div>
              <h2>My AI courses</h2>
              <p className="muted">Personal courses generated for you.</p>
            </div>
            <Link href="/student/studio" className="button secondary">
              Create another
            </Link>
          </div>
          <section className="course-grid">
            {personal.map((course, index) => (
              <CourseCard
                key={course.id}
                index={index}
                course={course}
                href={`/student/courses/${course.id}`}
                footer={
                  <span>
                    Personal ·{" "}
                    {calculateProgress(course, workspace.submissions, user.id)
                      .percent}
                    % complete
                  </span>
                }
              />
            ))}
          </section>
        </>
      )}
      <div className="section-heading">
        <div>
          <h2>Discover a course</h2>
          <p className="muted">Explore real problems through practice.</p>
        </div>
        <Link href="/student/path" className="button secondary">
          Build my learning path
        </Link>
      </div>
      <section className="course-grid">
        {catalog.map((course, index) => (
          <CourseCard
            key={course.id}
            index={index}
            course={course}
            href={`/student/courses/${course.id}`}
            footer={
              <span>
                {enrolled.has(course.id)
                  ? `Enrolled · Completed ${calculateProgress(course, workspace.submissions, user.id).percent}%`
                  : "Open for enrollment"}
              </span>
            }
          />
        ))}
      </section>
    </>
  );
}
