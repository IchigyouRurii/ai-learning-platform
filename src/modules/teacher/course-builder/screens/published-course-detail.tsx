import { subjectLabel } from "@/shared/ui/course-catalog";
import { courseLevel, lessonsAtLevel } from "@/shared/contracts";
import { CourseLevelNavigation } from "@/shared/ui/course-level-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getPublishedCourse } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { PageHeading, Badge } from "@/shared/ui/primitives";

/** Published, sanitized reading view. Author editing stays on the owner-only route. */
export async function PublishedCourseDetail({
  id,
  level: rawLevel,
}: {
  id: string;
  level?: string;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;
  const course = await getPublishedCourse(actor, id);
  if (!course) notFound();
  const level = courseLevel(rawLevel);
  const lessons = lessonsAtLevel(course.content.lessons, level);
  return (
    <>
      <Link href="/teacher" className="back-link">
        <ArrowLeft size={15} />
        Back to Marketplace
      </Link>
      <PageHeading
        eyebrow={subjectLabel(course.subject, course.title)}
        title={course.title}
        description={course.description}
        action={<Badge>Published v{course.version}</Badge>}
      />
      <p className="muted mb-6">By {course.author}</p>
      <CourseLevelNavigation
        value={level}
        href={`/teacher/marketplace/${id}`}
      />
      {!lessons.length && (
        <section className="panel mb-6">
          <p>No {level} materials have been generated yet.</p>
        </section>
      )}
      <div className="detail-grid">
        <div>
          {lessons.map((lesson, index) => (
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
                    <Badge>
                      {block.activity.type === "quiz" ? "Quiz" : "Activity"}
                    </Badge>
                    <h3>{block.activity.title}</h3>
                    <p>{block.activity.prompt}</p>
                    {block.activity.questions?.map((question) => (
                      <div key={question.id}>
                        <h4>{question.prompt}</h4>
                        <ul>
                          {question.options.map((option) => (
                            <li key={option.id}>{option.text}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" key={block.id}>
                    Media: {block.type} (renderer not yet available)
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
        <aside className="panel course-summary">
          <h3>Learning goals</h3>
          <ul>
            {course.content.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          {course.ownerId === actor.id && (
            <Link className="button secondary" href={`/teacher/courses/${id}`}>
              Manage in My Creation
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
