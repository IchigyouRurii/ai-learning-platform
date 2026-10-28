import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  Users,
} from "lucide-react";
import {
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { calculateQuizProgress, type Course } from "@/shared/contracts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import {
  Badge,
  EmptyState,
  PageHeading,
  ProgressBar,
  StatCard,
} from "@/shared/ui/primitives";
import { DeleteClassButton } from "../components/delete-class-button";
import { RemoveMemberButton } from "../components/remove-member-button";
import { StudentPicker } from "../components/student-picker";

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    timeZone: "Asia/Shanghai",
  });

function quizIdsForLesson(lesson: Course["lessons"][number]) {
  return lesson.blocks.flatMap((block) =>
    block.type === "activity" && block.activity.type === "quiz"
      ? [block.activity.id]
      : [],
  );
}

export async function TeacherClassDetail({
  id,
  query,
}: {
  id: string;
  query: string;
}) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const [classroomResult, membersResult, studentsResult, workspace] =
    await Promise.all([
      platformExtensions.classrooms.get(user, { classId: id }),
      platformExtensions.classrooms.listMembers(user, { classId: id }),
      platformExtensions.classrooms.listStudents(user, {
        search: query,
        limit: 200,
      }),
      getWorkspace(user),
    ]);
  if (!classroomResult.ok) {
    if (classroomResult.code === "NOT_FOUND") notFound();
    return (
      <>
        <PageHeading
          eyebrow="CLASS ROSTER"
          title="Class unavailable"
          description="The class could not be loaded."
        />
        <p className="error-text" role="alert">
          {classroomResult.error}
        </p>
      </>
    );
  }
  const classroom = classroomResult.data;
  const members = membersResult.ok ? membersResult.data : [];
  const memberEmails = new Set(
    members.map((member) => member.student.email.toLowerCase()),
  );
  const availableStudents = studentsResult.ok
    ? studentsResult.data.items.filter(
        (student) => !memberEmails.has(student.email.toLowerCase()),
      )
    : [];
  const course = workspace.courses.find(
    (item) => item.id === classroom.courseId,
  );
  const rows = members.map((member) => {
    const quiz = course
      ? calculateQuizProgress(course, workspace.submissions, member.student.id)
      : null;
    const latestQuiz = course
      ? workspace.submissions
          .filter(
            (item) =>
              item.courseId === course.id &&
              item.courseVersion === course.version &&
              item.studentId === member.student.id &&
              item.score != null,
          )
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    return { member, quiz, latestQuiz };
  });
  const lessonsWithQuizzes = course
    ? course.lessons.filter((lesson) => quizIdsForLesson(lesson).length).length
    : 0;
  const completedStudents = rows.filter((row) => row.quiz?.completed).length;
  const averageChapterPercent = rows.length
    ? Math.round(
        (rows.reduce((sum, row) => {
          if (!row.quiz || row.quiz.lessonsWithQuizzes === 0) return sum;
          return sum + row.quiz.passedLessons / row.quiz.lessonsWithQuizzes;
        }, 0) /
          rows.length) *
          100,
      )
    : 0;
  const needsAttention = rows.filter(
    (row) =>
      row.quiz &&
      row.quiz.lessonsWithQuizzes > 0 &&
      row.quiz.passedQuizzes === 0,
  ).length;
  const chapterStats = course
    ? course.lessons.flatMap((lesson) => {
        const quizIds = quizIdsForLesson(lesson);
        if (!quizIds.length) return [];
        const passedStudents = rows.filter(
          (row) =>
            row.quiz?.lessons.find((item) => item.lessonId === lesson.id)
              ?.passed,
        ).length;
        return [
          {
            lessonId: lesson.id,
            title: lesson.title,
            quizCount: quizIds.length,
            passedStudents,
            percent: members.length
              ? Math.round((passedStudents / members.length) * 100)
              : 0,
          },
        ];
      })
    : [];

  return (
    <>
      <Link href="/teacher/classes" className="back-link">
        <ArrowLeft size={15} />
        Back to Classes
      </Link>
      <PageHeading
        eyebrow="CLASS ROSTER"
        title={classroom.name}
        description={
          classroom.description || "Manage the students in this class."
        }
        action={
          <div className="flex items-center gap-2">
            <Badge>
              {classroom.memberCount}{" "}
              {classroom.memberCount === 1 ? "student" : "students"}
            </Badge>
            <DeleteClassButton
              classId={classroom.id}
              className={classroom.name}
            />
          </div>
        }
      />
      <p className="form-hint">
        Course:{" "}
        <Link href={`/teacher/courses/${classroom.courseId}`}>
          {classroom.courseTitle}
        </Link>
      </p>
      {!course && (
        <p className="error-text" role="alert">
          The course bound to this class is not available in your workspace, so
          quiz progress cannot be calculated.
        </p>
      )}
      <section className="stats-grid" aria-label="Class progress summary">
        <StatCard
          label="Students"
          value={members.length}
          detail="Current class members"
          icon={<Users size={17} />}
        />
        <StatCard
          label="Completed students"
          value={`${completedStudents} / ${members.length}`}
          detail="Passed every chapter quiz"
          icon={<CheckCircle2 size={17} />}
        />
        <StatCard
          label="Average chapter completion"
          value={`${averageChapterPercent}%`}
          detail="Based on quiz passes"
          icon={<ListChecks size={17} />}
        />
        <StatCard
          label="Needs attention"
          value={needsAttention}
          detail="No quiz passed yet"
          icon={<AlertTriangle size={17} />}
        />
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Student progress</h2>
              <p className="muted">
                A chapter is complete when the student passes every quiz in it
                with at least 60%. The best attempt is used, and quizzes can be
                retaken.
              </p>
            </div>
            <Link href="/teacher/students" className="text-link">
              View submissions &amp; feedback
            </Link>
          </div>
          {!membersResult.ok ? (
            <p className="error-text" role="alert">
              {membersResult.error}
            </p>
          ) : !members.length ? (
            <EmptyState title="No students yet">
              Add registered students from the student directory.
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Chapters</TableHead>
                  <TableHead>Quizzes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last quiz</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ member, quiz, latestQuiz }) => (
                  <TableRow key={member.student.id}>
                    <TableCell className="font-medium">
                      {member.student.name}
                    </TableCell>
                    <TableCell>{member.student.email}</TableCell>
                    <TableCell>{dateLabel(member.joinedAt)}</TableCell>
                    <TableCell>
                      {quiz
                        ? `${quiz.passedLessons} / ${quiz.lessonsWithQuizzes}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {quiz
                        ? `${quiz.passedQuizzes} / ${quiz.totalQuizzes}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {quiz && quiz.lessonsWithQuizzes > 0 ? (
                        <Badge tone={quiz.completed ? "green" : "amber"}>
                          {quiz.completed ? "Completed" : "In progress"}
                        </Badge>
                      ) : (
                        <span className="muted">No quizzes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {latestQuiz
                        ? dateLabel(latestQuiz.createdAt)
                        : "No quiz yet"}
                    </TableCell>
                    <TableCell className="text-right">
                      <RemoveMemberButton
                        classId={classroom.id}
                        studentId={member.student.id}
                        studentName={member.student.name}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        <aside className="panel">
          {studentsResult.ok ? (
            <StudentPicker
              classId={classroom.id}
              students={availableStudents}
              query={query}
            />
          ) : (
            <p className="error-text" role="alert">
              {studentsResult.error}
            </p>
          )}
        </aside>
      </div>
      <section className="panel mt-6">
        <div className="panel-heading">
          <div>
            <h2>Chapter completion</h2>
            <p className="muted">
              Students who passed every quiz in each chapter. Chapters without
              quizzes are not counted.
            </p>
          </div>
          <Badge>
            {lessonsWithQuizzes}{" "}
            {lessonsWithQuizzes === 1 ? "chapter" : "chapters"}
          </Badge>
        </div>
        {!chapterStats.length ? (
          <p className="muted">
            This course has no quiz activities yet. Publish a course with
            quizzes to track class progress here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chapter</TableHead>
                <TableHead>Quizzes</TableHead>
                <TableHead>Students passed</TableHead>
                <TableHead>Completion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chapterStats.map((chapter) => (
                <TableRow key={chapter.lessonId}>
                  <TableCell className="font-medium">{chapter.title}</TableCell>
                  <TableCell>{chapter.quizCount}</TableCell>
                  <TableCell>
                    {chapter.passedStudents} / {members.length}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-28">
                      <ProgressBar percent={chapter.percent} />
                      <span className="form-hint">{chapter.percent}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
