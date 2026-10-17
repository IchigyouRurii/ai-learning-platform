import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { Badge, PageHeading, ProgressBar } from "@/shared/ui/primitives";
import { ActivityForm } from "../../activities/components/activity-form";
import { EnrollButton } from "../../activities/components/enroll-button";

export async function StudentCourseDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const course = workspace.courses.find((item) => item.id === id);
  if (!course) notFound();
  const enrolled = workspace.enrollments.some((item) => item.courseId === id);
  const progress = calculateProgress(course, workspace.submissions, user.id);
  return (
    <>
      <Link href="/student" className="back-link">
        <ArrowLeft size={15} />
        返回课程广场
      </Link>
      <PageHeading
        eyebrow={course.subject}
        title={course.title}
        description={course.description}
      />
      <div className="detail-grid">
        <div>
          {!enrolled ? (
            <section className="panel join-panel">
              <Target size={36} strokeWidth={1.2} />
              <h2>准备好探索这个主题了吗？</h2>
              <p className="muted">
                加入后可以完成活动、获取反馈，并保存学习记录。
              </p>
              <EnrollButton courseId={course.id} />
            </section>
          ) : (
            course.lessons.map((lesson, index) => (
              <section
                className="panel lesson-panel"
                id={lesson.id}
                key={lesson.id}
              >
                <p className="eyebrow">
                  LESSON {String(index + 1).padStart(2, "0")}
                </p>
                <h2>{lesson.title}</h2>
                {lesson.blocks.map((block) =>
                  block.type === "text" ? (
                    <p className="prose-text" key={block.id}>
                      {block.body}
                    </p>
                  ) : block.type === "activity" &&
                    block.activity.type === "reflection" ? (
                    <ActivityForm
                      key={block.id}
                      courseId={course.id}
                      activity={block.activity}
                      latest={workspace.submissions.findLast(
                        (item) =>
                          item.courseId === course.id &&
                          item.courseVersion === course.version &&
                          item.activityId === block.activity.id,
                      )}
                    />
                  ) : (
                    <div key={block.id} className="activity-preview">
                      <p>
                        此内容类型的渲染器尚未接入：
                        {block.type === "activity"
                          ? block.activity.type
                          : block.type}
                      </p>
                    </div>
                  ),
                )}
              </section>
            ))
          )}
        </div>
        <aside className="panel course-summary">
          <Badge tone="green">{course.lessons.length} 节短课</Badge>
          <h3>你将学会</h3>
          <ul>
            {course.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          <hr />
          <h3>学习进度</h3>
          <ProgressBar percent={progress.percent} />
          <p className="muted">
            {progress.done} / {progress.total} 个互动任务已提交
          </p>
          <p className="form-hint">
            完成状态仅表示提交过任务，不代表知识掌握程度。
          </p>
          <hr />
          <Link href="/student/progress" className="text-link">
            查看学习记录与教师反馈 →
          </Link>
        </aside>
      </div>
    </>
  );
}
