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
        title="带着好奇，开始今天的探索。"
        description="一点讲解，一次实践。按自己的节奏，把新知识变成自己的能力。"
      />
      <section className="student-banner">
        <div>
          <span className="eyebrow">SMALL LESSONS. REAL PROGRESS.</span>
          <h2>
            不需要一次学会所有，
            <br />
            先完成一个小任务。
          </h2>
          <p>选择感兴趣的主题，尝试回答，再从反馈中继续前进。</p>
        </div>
        <Compass size={116} strokeWidth={0.65} aria-hidden="true" />
      </section>
      <section className="stats-grid">
        <StatCard
          label="已加入课程"
          value={enrolled.size}
          detail="在学习中找到自己的节奏"
          icon={<BookOpen size={17} />}
        />
        <StatCard
          label="已完成课程"
          value={completed}
          detail="按互动任务完成情况计算"
          icon={<CheckCheck size={17} />}
        />
        <StatCard
          label="可探索课程"
          value={workspace.courses.length}
          detail="从软件开发与 AI 协作开始"
          icon={<Compass size={17} />}
        />
      </section>
      <div className="section-heading">
        <div>
          <h2>发现一门小课</h2>
          <p className="muted">从真实问题出发，通过实践理解。</p>
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
                  ? `已加入 · 完成 ${calculateProgress(course, workspace.submissions, user.id).percent}%`
                  : "开放加入"}
              </span>
            }
          />
        ))}
      </section>
    </>
  );
}
