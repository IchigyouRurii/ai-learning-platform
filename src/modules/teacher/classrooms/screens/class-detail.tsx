import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
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
import { AwaitingReplySummary } from "../components/awaiting-reply-summary";
import { PassSummary } from "../components/pass-summary";
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
  const memberIds = new Set(members.map((member) => member.student.id));
  const participating = new Set(
    workspace.submissions.filter((submission) =>
      submission.courseId === classroom.courseId &&
      memberIds.has(submission.studentId),
    ).map((submission) => submission.studentId),
  ).size;
  // Count all pages, retaining the course's access checks and current class scope.
  let pendingQuestions = 0;
  let pendingNotes = 0;
  let communicationAvailable = true;
  let cursor: string | undefined;
  do {
    const page = await platformExtensions.discussions.listThreads(user, {
      courseId: classroom.courseId, limit: 100, cursor,
    });
    if (!page.ok) { communicationAvailable = false; break; }
    const threads = await Promise.all(page.data.items.filter((question) =>
      memberIds.has(question.author.id) && question.status === "open" && !question.deletedAt,
    ).map((question) => platformExtensions.discussions.getThread(user, { questionId: question.id })));
    for (const thread of threads) {
      if (!thread.ok) { communicationAvailable = false; continue; }
      if (!thread.data.replies.some((reply) => reply.author.role === "teacher" && !reply.deletedAt))
        pendingQuestions++;
    }
    cursor = page.data.nextCursor ?? undefined;
  } while (cursor);
  cursor = undefined;
  do {
    const page = await platformExtensions.annotations.listForTeacher(user, {
      courseId: classroom.courseId, limit: 100, cursor,
    });
    if (!page.ok) { communicationAvailable = false; break; }
    pendingNotes += page.data.items.filter((note) =>
      memberIds.has(note.student.id) && note.status === "open",
    ).length;
    cursor = page.data.nextCursor ?? undefined;
  } while (cursor);
  const chapterStats = course
    ? course.lessons.flatMap((lesson) => {
        const quizIds = quizIdsForLesson(lesson);
        if (!quizIds.length) return [];
        const passedStudents = rows.filter(
          (row) =>
            row.quiz?.lessons.find((item) => item.lessonId === lesson.id)
              ?.passed,
        ).length;
        const scores = rows
          .map(
            (row) =>
              row.quiz?.lessons.find((item) => item.lessonId === lesson.id)
                ?.bestScorePercent,
          )
          .filter(
            (score): score is number => score !== null && score !== undefined,
          );
        const averageScore = scores.length
          ? Math.round(
              scores.reduce((sum, score) => sum + score, 0) / scores.length,
            )
          : null;
        return [
          {
            lessonId: lesson.id,
            title: lesson.title,
            quizCount: quizIds.length,
            passedStudents,
            averageScore,
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
      <section
        className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Class progress summary"
      >
        <StatCard
          label="Students"
          value={members.length}
          detail="Current class members"
          icon={<Users size={17} />}
        />
        <PassSummary passed={completedStudents} total={members.length} />
        <StatCard
          label="Participating students"
          value={participating}
          detail={`${members.length - participating} not started · Submitted an activity or quiz`}
          icon={<ListChecks size={17} />}
        />
        <AwaitingReplySummary
          courseId={classroom.courseId}
          courseTitle={classroom.courseTitle}
          questions={pendingQuestions}
          notes={pendingNotes}
          available={communicationAvailable}
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
                  <TableHead>Student</TableHead>
                  <TableHead>Chapters</TableHead>
                  <TableHead>Quizzes</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last quiz</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ member, quiz, latestQuiz }) => (
                  <TableRow key={member.student.id}>
                    <TableCell>
                      <strong className="block text-sm">
                        {member.student.name}
                      </strong>
                      <span className="muted text-xs">
                        {member.student.email}
                      </span>
                    </TableCell>
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
                      {quiz?.averageScorePercent != null ? (
                        <div>
                          <strong>{quiz.averageScorePercent}%</strong>
                          <span className="form-hint block">
                            best {quiz.bestScorePercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
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
                <TableHead>Avg score</TableHead>
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
                    {chapter.averageScore !== null
                      ? `${chapter.averageScore}%`
                      : "—"}
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
