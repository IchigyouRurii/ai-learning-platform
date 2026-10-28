import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Info, Users } from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  AssignmentTable,
  ClassLoadError,
  ClassPagination,
  classDate,
} from "@/modules/platform/classes/common";
import { EmptyState, PageHeading, StatCard } from "@/shared/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import styles from "@/modules/platform/classes/classes.module.css";
import { ClassForm } from "../components/class-form";
import {
  ClassRemovalDialog,
  ImportStudentsDialog,
  JoinCodeDialog,
} from "../components/member-tools";
import { AssignCourseDialog } from "../components/assign-course";
export async function TeacherClassDetail({
  id,
  cursor,
}: {
  id: string;
  cursor?: string;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;
  const service = platformExtensions.classrooms;
  const result = await service.get(actor, { classId: id });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <ClassLoadError error={result.error} />;
  }
  const classroom = result.data;
  const active = classroom.status === "active";
  const [members, assignments, courses] = await Promise.all([
    service.listMembers(actor, { classId: id }),
    service.listAssignments(actor, { classId: id, cursor, limit: 20 }),
    service.listAssignableCourses(actor, { classId: id }),
  ]);
  return (
    <>
      <Link className="back-link" href="/teacher/classes">
        <ArrowLeft size={15} />
        Back to classes
      </Link>
      <PageHeading
        eyebrow="CLASSROOM"
        title={classroom.name}
        description={
          classroom.description || "A shared space for courses and learning."
        }
        action={active ? <ClassForm classroom={classroom} /> : undefined}
      />
      {!active && (
        <p className={styles.note}>
          <Info size={17} />
          This class has been archived by an administrator.{" "}
          {classroom.archiveReason} Members and assignments are preserved; class
          editing and class learning access are paused.
        </p>
      )}
      <div className={styles.summary}>
        <StatCard
          label="Students"
          value={classroom.memberCount}
          detail="Current class members"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Course assignments"
          value={classroom.assignmentCount}
          detail="Published versions assigned to this class"
          icon={<BookOpen size={18} />}
        />
        <StatCard
          label="Class created"
          value={classDate(classroom.createdAt)}
          detail={`Managed by ${classroom.teacherName}`}
          icon={<Users size={18} />}
        />
      </div>
      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Course assignments</h2>
            <p>A clear next step for everyone in this class.</p>
          </div>
          {active && courses.ok && (
            <AssignCourseDialog classId={id} courses={courses.data} />
          )}
        </div>
        {!courses.ok && (
          <p className={styles.error} role="alert">
            {courses.error}
          </p>
        )}
        {assignments.ok ? (
          <>
            <AssignmentTable
              assignments={assignments.data.items}
              teacherAction={(item) => (
                <div className={styles.actions}>
                  <Link
                    className="text-link"
                    href={`/teacher/courses/${item.courseId}`}
                  >
                    View course
                  </Link>
                  {active && (
                    <ClassRemovalDialog
                      kind="assignment"
                      classId={id}
                      targetId={item.id}
                      name={`${item.title} · v${item.courseVersion}`}
                    />
                  )}
                </div>
              )}
            />
            <ClassPagination
              base={`/teacher/classes/${id}`}
              cursor={cursor}
              nextCursor={assignments.data.nextCursor}
              label="assignments"
            />
          </>
        ) : (
          <ClassLoadError error={assignments.error} />
        )}
      </section>
      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Class members</h2>
            <p>Invite students with a join code or add existing accounts.</p>
          </div>
          {active && (
            <div className={styles.actions}>
              <JoinCodeDialog classId={id} />
              <ImportStudentsDialog classId={id} />
            </div>
          )}
        </div>
        {members.ok ? (
          members.data.length ? (
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.data.map((item) => (
                  <TableRow key={item.student.id}>
                    <TableCell className={styles.title}>
                      {item.student.name}
                    </TableCell>
                    <TableCell>{classDate(item.joinedAt)}</TableCell>
                    <TableCell>
                      {active ? (
                        <ClassRemovalDialog
                          kind="member"
                          classId={id}
                          targetId={item.student.id}
                          name={item.student.name}
                        />
                      ) : (
                        <span className={styles.hint}>Archived</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="Ready for your first students">
              Generate a join code and share it with your class, or add
              registered student accounts.
            </EmptyState>
          )
        ) : (
          <ClassLoadError error={members.error} />
        )}
      </section>
      <p className={styles.note}>
        <Info size={17} />
        Removing a member or an assignment revokes its class learning access.
        Learning records and independent course enrollments are retained.
        Individual feedback remains in Teaching Management.
      </p>
    </>
  );
}
