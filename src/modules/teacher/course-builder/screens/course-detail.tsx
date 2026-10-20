import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getWorkspace } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { Badge, PageHeading } from "@/shared/ui/primitives";
import { TeacherCourseDiscussion } from "@/modules/teacher/discussions/screens/course-discussion";
import { PublishButton } from "../components/publish-button";

export async function TeacherCourseDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const workspace = await getWorkspace(user);
  const course = workspace.courses.find((item) => item.id === id);
  if (!course) notFound();
  return (
    <>
      <Link href="/teacher/creations" className="back-link">
        <ArrowLeft size={15} />
        Back to My Creations
      </Link>
      <PageHeading
        eyebrow="COURSE PREVIEW"
        title={course.title}
        description={course.description}
        action={
          <Badge tone={course.status === "published" ? "green" : "amber"}>
            {course.status === "published" ? "Published" : "Unpublished draft"}
          </Badge>
        }
      />
      <div className="detail-grid">
        <div>
          {course.lessons.map((lesson, index) => (
            <section className="panel lesson-panel" key={lesson.id}>
              <p className="eyebrow">
                LESSON {String(index + 1).padStart(2, "0")}
              </p>
              <h2>{lesson.title}</h2>
              {lesson.blocks.map((block) =>
                block.type === "text" ? (
                  <p className="prose-text" key={block.id}>
                    {block.body}
                  </p>
                ) : block.type === "activity" ? (
                  <div className="activity-preview" key={block.id}>
                    <Badge>Activities</Badge>
                    <h3>{block.activity.title}</h3>
                    <p>{block.activity.prompt}</p>
                    <details>
                      <summary>View assessment criteria</summary>
                      <p className="muted">{block.activity.rubric}</p>
                    </details>
                  </div>
                ) : (
                  <p className="muted" key={block.id}>
                    Media: {block.type}(renderer not yet available)
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
        <aside className="panel course-summary">
          <p className="eyebrow">COURSE NOTES</p>
          <h3>Learning goals</h3>
          <ul>
            {course.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          <hr />
          <h3>Target audience</h3>
          <p className="muted">{course.audience}</p>
          <hr />
          {course.status === "draft" ? (
            <>
              <p className="form-hint">
                Check content accuracy and activity suitability before
                publishing.
              </p>
              <PublishButton courseId={course.id} />
            </>
          ) : (
            <p className="muted">
              This course is available to students. Demo users can switch roles
              in the header.
            </p>
          )}
        </aside>
      </div>
      {course.status === "published" && (
        <TeacherCourseDiscussion courseId={course.id} />
      )}
    </>
  );
}
