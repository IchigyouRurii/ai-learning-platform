import Link from "next/link";
import { BookOpen, CheckCheck, Plus, Users, ArrowUpRight } from "lucide-react";
import { getCurrentUser, getWorkspace } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { CourseCard, PageHeading, StatCard } from "@/shared/ui/primitives";

export async function TeacherCourseList() {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const workspace = await getWorkspace(user);
  return (
    <>
      <PageHeading
        eyebrow="TEACHER WORKSPACE"
        title="让好想法，成为一门好课。"
        description="设计短小、有参与感的学习体验，与学生一起把知识用起来。"
        action={
          <Link href="/teacher/courses/new" className="button primary">
            <Plus size={16} />
            创建微课程
          </Link>
        }
      />
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">MAKE ROOM FOR CURIOSITY</span>
          <h2>
            你来定义目标，
            <br />
            AI 帮你迈出第一步。
          </h2>
          <p>
            从一个主题、一份教学材料开始，
            <br className="desktop-break" />
            生成草稿，再加入你的经验和判断。
          </p>
          <Link href="/teacher/courses/new" className="text-link">
            开始设计课程 <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit" />
          <div className="hero-card hero-card-back" />
          <div className="hero-card hero-card-front">
            <span>YOUR NEXT</span>
            <strong>小课</strong>
            <div className="hero-lines">
              <i />
              <i />
              <i />
            </div>
            <span className="hero-spark">✳</span>
          </div>
          <span className="hero-small-star">✦</span>
        </div>
      </section>
      <section className="stats-grid">
        <StatCard
          label="我的课程"
          value={workspace.courses.length}
          detail={`${workspace.courses.filter((course) => course.status === "draft").length} 门待完善草稿`}
          icon={<BookOpen size={17} />}
        />
        <StatCard
          label="已加入学生"
          value={
            new Set(workspace.enrollments.map((item) => item.studentId)).size
          }
          detail="按课程成员去重"
          icon={<Users size={17} />}
        />
        <StatCard
          label="活动提交"
          value={workspace.submissions.length}
          detail="从参与中了解学习情况"
          icon={<CheckCheck size={17} />}
        />
      </section>
      <div className="section-heading">
        <div>
          <h2>
            我的课程{" "}
            <span className="count-pill">{workspace.courses.length}</span>
          </h2>
          <p className="muted">每一门短课，都是一次新的探索。</p>
        </div>
        <span className="subtle-label">全部课程</span>
      </div>
      <section className="course-grid">
        {workspace.courses.map((course, index) => (
          <CourseCard
            key={course.id}
            course={course}
            index={index}
            href={`/teacher/courses/${course.id}`}
          />
        ))}
      </section>
    </>
  );
}
