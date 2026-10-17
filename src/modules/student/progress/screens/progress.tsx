import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { EmptyState, PageHeading, ProgressBar } from "@/shared/ui/primitives";

export async function StudentProgress() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const courses = workspace.courses.filter((course) =>
    workspace.enrollments.some((item) => item.courseId === course.id),
  );
  return (
    <>
      <PageHeading
        eyebrow="MY LEARNING"
        title="每一个小进步，都算数。"
        description="回看你的参与记录，也看看老师留下的建议。"
      />
      <section className="panel">
        <h2>正在学习</h2>
        {!courses.length ? (
          <EmptyState title="还没有加入课程">
            到课程广场选择感兴趣的主题。
          </EmptyState>
        ) : (
          courses.map((course) => {
            const progress = calculateProgress(
              course,
              workspace.submissions,
              user.id,
            );
            return (
              <div className="progress-row" key={course.id}>
                <div>
                  <Link href={`/student/courses/${course.id}`}>
                    <h3>{course.title}</h3>
                  </Link>
                  <p className="muted">
                    {progress.done} / {progress.total} 项任务已提交
                  </p>
                </div>
                <div className="progress-cell">
                  <strong>{progress.percent}%</strong>
                  <ProgressBar percent={progress.percent} />
                </div>
                <Link
                  href={`/student/courses/${course.id}`}
                  className="button secondary"
                >
                  继续学习
                </Link>
              </div>
            );
          })
        )}
      </section>
      <section className="panel feedback-section">
        <div className="section-heading">
          <h2>
            <MessageSquareText size={20} />
            教师反馈
          </h2>
        </div>
        {!workspace.feedback.length ? (
          <p className="muted">老师留下建议后，会显示在这里。</p>
        ) : (
          workspace.feedback.toReversed().map((feedback) => (
            <article className="feedback-note" key={feedback.id}>
              <strong>
                {workspace.courses.find(
                  (course) => course.id === feedback.courseId,
                )?.title ?? "课程反馈"}
              </strong>
              <p className="prose-text">{feedback.message}</p>
              <small>
                {new Date(feedback.createdAt).toLocaleDateString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })}
              </small>
            </article>
          ))
        )}
      </section>
    </>
  );
}
