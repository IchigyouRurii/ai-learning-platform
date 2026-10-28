import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, School, Users } from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import {
  Badge,
  EmptyState,
  PageHeading,
  StatCard,
} from "@/shared/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { AssignmentTable } from "@/modules/platform/classes/common";
import { AdminClassroomDialog } from "../components/classroom-dialog";
import { AdminLoadError } from "../components/load-error";
import { AdminNote, AdminTabs } from "../components/common";
import { displayDate } from "../query";
import styles from "../admin.module.css";
import classStyles from "@/modules/platform/classes/classes.module.css";
export async function AdminClassroomDetailScreen({ id }: { id: string }) {
  const actor = await getCurrentUser();
  const result = await platformExtensions.administration.getClassroom(actor, {
    classId: id,
  });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <AdminLoadError message={result.error} />;
  }
  const { classroom, members, assignments } = result.data;
  return (
    <>
      <Link className="back-link" href="/admin/classes">
        <ArrowLeft size={15} />
        Back to classrooms
      </Link>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title={classroom.name}
        description={
          classroom.description || "Classroom details and management."
        }
        action={<AdminClassroomDialog kind="status" classroom={classroom} />}
      />
      <AdminTabs current="classrooms" />
      <AdminNote icon={<School size={17} />}>
        <strong>Teacher: {classroom.teacherName}</strong> · Created{" "}
        {displayDate(classroom.createdAt)} ·{" "}
        <Badge tone={classroom.status === "active" ? "green" : "amber"}>
          {classroom.status === "active" ? "Active" : "Archived"}
        </Badge>
        {classroom.status === "archived" && (
          <span className={styles.secondary}>
            {classroom.archiveReason} · Archived{" "}
            {classroom.archivedAt ? displayDate(classroom.archivedAt) : ""} by{" "}
            {classroom.archivedByName}
          </span>
        )}
      </AdminNote>
      <div className={classStyles.summary}>
        <StatCard
          label="Students"
          value={classroom.memberCount}
          detail="Current class members"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Assignments"
          value={classroom.assignmentCount}
          detail="Assigned published course versions"
          icon={<BookOpen size={18} />}
        />
        <StatCard
          label="Class status"
          value={classroom.status === "active" ? "Active" : "Archived"}
          detail={
            classroom.status === "active"
              ? "Class activities available"
              : "Class activities paused"
          }
          icon={<School size={18} />}
        />
      </div>
      <section className={`panel ${classStyles.section}`}>
        <div className={classStyles.sectionHeading}>
          <div>
            <h2>Course assignments</h2>
            <p>Metadata for the versions assigned to this class.</p>
          </div>
        </div>
        <AssignmentTable
          assignments={assignments}
          teacherAction={(item) => (
            <AdminClassroomDialog
              kind="assignment"
              classroom={classroom}
              assignmentId={item.id}
              targetName={`${item.title} · v${item.courseVersion}`}
            />
          )}
        />
      </section>
      <section className={`panel ${classStyles.section}`}>
        <div className={classStyles.sectionHeading}>
          <div>
            <h2>Class members</h2>
            <p>Manage current membership while preserving learning records.</p>
          </div>
        </div>
        {!members.length ? (
          <EmptyState title="No current members">
            Students will appear here after joining this class.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((item) => (
                <TableRow key={item.student.id}>
                  <TableCell className={styles.name}>
                    {item.student.name}
                  </TableCell>
                  <TableCell>{displayDate(item.joinedAt)}</TableCell>
                  <TableCell>
                    <AdminClassroomDialog
                      kind="member"
                      classroom={classroom}
                      studentId={item.student.id}
                      targetName={item.student.name}
                    />
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
