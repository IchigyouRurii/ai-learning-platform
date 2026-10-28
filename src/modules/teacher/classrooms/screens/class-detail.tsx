import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Users,
} from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
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
    const progress = course
      ? calculateProgress(course, workspace.submissions, member.student.id)
      : null;
    const latest = course
      ? workspace.submissions
          .filter(
            (item) =>
              item.courseId === course.id &&
              item.courseVersion === course.version &&
              item.studentId === member.student.id,
          )
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    const lessonsDone = course
      ? new Set(
          (workspace.lessonCompletions ?? [])
            .filter(
              (item) =>
                item.courseId === course.id &&
                item.courseVersion === course.version &&
                item.studentId === member.student.id,
            )
            .map((item) => item.lessonId),
        ).size
      : 0;
    return { member, progress, latest, lessonsDone };
  });
  const tracked = rows.filter(
    (row): row is typeof row & { progress: NonNullable<typeof row.progress> } =>
      row.progress !== null,
  );
  const averagePercent = tracked.length
    ? Math.round(
        tracked.reduce((sum, row) => sum + row.progress.percent, 0) /
          tracked.length,
      )
    : 0;
  const completedCount = tracked.filter(
    (row) => row.progress.percent === 100,
  ).length;
  const needsAttention = tracked.filter(
    (row) => row.progress.percent < 50,
  ).length;

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
          progress cannot be calculated.
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
          label="Average completion"
          value={`${averagePercent}%`}
          detail="Based on submitted activities"
          icon={<BarChart3 size={17} />}
        />
        <StatCard
          label="Completed"
          value={completedCount}
          detail="Students at 100%"
          icon={<CheckCircle2 size={17} />}
        />
        <StatCard
          label="Needs attention"
          value={needsAttention}
          detail="Below 50% completion"
          icon={<AlertTriangle size={17} />}
        />
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Student progress</h2>
              <p className="muted">
                Completion is based on activity submissions for the course bound
                to this class. It is not a mastery score.
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
                  <TableHead>Activities</TableHead>
                  <TableHead>Lessons</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ member, progress, latest, lessonsDone }) => (
                  <TableRow key={member.student.id}>
                    <TableCell className="font-medium">
                      {member.student.name}
                    </TableCell>
                    <TableCell>{member.student.email}</TableCell>
                    <TableCell>{dateLabel(member.joinedAt)}</TableCell>
                    <TableCell>
                      {progress
                        ? `${progress.done} / ${progress.total}`
                        : "Not available"}
                    </TableCell>
                    <TableCell>
                      {course ? `${lessonsDone} / ${course.lessons.length}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-28">
                        <ProgressBar percent={progress?.percent ?? 0} />
                        <span className="form-hint">
                          {progress ? `${progress.percent}%` : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {latest ? dateLabel(latest.createdAt) : "No activity yet"}
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
    </>
  );
}
