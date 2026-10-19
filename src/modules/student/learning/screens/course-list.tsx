import { BookOpen, CheckCheck, Compass } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { CourseCard, PageHeading, StatCard } from "@/shared/ui/primitives";

export async function StudentCourseList() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const enrolled = new Set(workspace.enrollments.map((item) => item.courseId));
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
      <div className="section-heading">
        <div>
          <h2>Discover a course</h2>
          <p className="muted">Explore real problems through practice.</p>
        </div>
      </div>
      <section className="course-grid">
        {workspace.courses.map((course, index) => (
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
