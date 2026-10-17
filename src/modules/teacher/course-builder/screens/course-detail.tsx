import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getWorkspace } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { Badge, PageHeading } from "@/shared/ui/primitives";
import { PublishButton } from "../components/publish-button";

export async function TeacherCourseDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const workspace = await getWorkspace(user);
  const course = workspace.courses.find((item) => item.id === id);
  if (!course) notFound();
  return (
    <>
      <Link href="/teacher" className="back-link">
        <ArrowLeft size={15} />
        返回我的课程
      </Link>
      <PageHeading
        eyebrow="COURSE PREVIEW"
        title={course.title}
        description={course.description}
        action={
          <Badge tone={course.status === "published" ? "green" : "amber"}>
            {course.status === "published" ? "已发布" : "待发布草稿"}
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
                    <Badge>互动任务</Badge>
                    <h3>{block.activity.title}</h3>
                    <p>{block.activity.prompt}</p>
                    <details>
                      <summary>查看评价标准</summary>
                      <p className="muted">{block.activity.rubric}</p>
                    </details>
                  </div>
                ) : (
                  <p className="muted" key={block.id}>
                    媒体内容：{block.type}（渲染器待接入）
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
        <aside className="panel course-summary">
          <p className="eyebrow">COURSE NOTES</p>
          <h3>学习目标</h3>
          <ul>
            {course.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          <hr />
          <h3>目标学习者</h3>
          <p className="muted">{course.audience}</p>
          <hr />
          {course.status === "draft" ? (
            <>
              <p className="form-hint">
                请确认内容准确，且任务适合学习者，再发布课程。
              </p>
              <PublishButton courseId={course.id} />
            </>
          ) : (
            <p className="muted">
              课程已在学生端开放。可在右上角切换身份体验。
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
