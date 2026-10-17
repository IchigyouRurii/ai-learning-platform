import { Users } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  Badge,
  EmptyState,
  PageHeading,
  ProgressBar,
} from "@/shared/ui/primitives";
import { FeedbackForm } from "../components/feedback-form";

export async function TeacherStudents() {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;
  const workspace = await getWorkspace(actor);
  return (
    <>
      <PageHeading
        eyebrow="PARTICIPATION & FEEDBACK"
        title="看见参与，也回应每一次尝试。"
        description="查看课程成员和任务提交情况，为学生提供下一步建议。"
      />
      <div className="inline-note">
        <Users size={17} />
        <span>
          学生加入课程后，参与情况会显示在这里。完成度按已提交的互动任务计算。
        </span>
      </div>
      {!workspace.enrollments.length ? (
        <EmptyState title="还没有学生加入">
          发布课程后，切换到学生身份加入并提交一次活动。
        </EmptyState>
      ) : (
        workspace.enrollments.map((enrollment) => {
          const course = workspace.courses.find(
            (item) => item.id === enrollment.courseId,
          );
          if (!course) return null;
          const progress = calculateProgress(
            course,
            workspace.submissions,
            enrollment.studentId,
          );
          const submissions = workspace.submissions.filter(
            (item) =>
              item.courseId === course.id &&
              item.studentId === enrollment.studentId &&
              item.courseVersion === course.version,
          );
          const latestByActivity = [
            ...new Map(
              submissions.map((item) => [item.activityId, item]),
            ).values(),
          ];
          return (
            <section
              className="panel learner-panel"
              key={`${course.id}-${enrollment.studentId}`}
            >
              <div className="learner-header">
                <div className="learner-name">
                  <span className="avatar">学</span>
                  <div>
                    <h3>
                      {workspace.members.find(
                        (member) => member.id === enrollment.studentId,
                      )?.name ?? "学生"}
                    </h3>
                    <p className="muted">{course.title}</p>
                  </div>
                </div>
                <Badge tone={progress.percent === 100 ? "green" : "neutral"}>
                  {progress.percent === 100 ? "任务已提交" : "学习中"}
                </Badge>
              </div>
              <div className="learner-progress">
                <ProgressBar percent={progress.percent} />
                <span>
                  {progress.done} / {progress.total} 项任务
                </span>
              </div>
              {latestByActivity.length ? (
                latestByActivity.map((submission) => (
                  <details className="submission-detail" key={submission.id}>
                    <summary>查看最近的回答与学习反馈</summary>
                    <h4>学生回答</h4>
                    <p className="prose-text">{submission.answer}</p>
                    <h4>学习反馈</h4>
                    <p className="prose-text muted">{submission.aiFeedback}</p>
                  </details>
                ))
              ) : (
                <p className="muted">学生已加入，暂未提交活动。</p>
              )}
              <FeedbackForm
                courseId={course.id}
                studentId={enrollment.studentId}
              />
            </section>
          );
        })
      )}
    </>
  );
}
