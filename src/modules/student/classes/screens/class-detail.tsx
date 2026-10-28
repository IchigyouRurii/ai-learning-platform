import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  AssignmentTable,
  ClassLoadError,
  ClassPagination,
} from "@/modules/platform/classes/common";
import { PageHeading } from "@/shared/ui/primitives";
import styles from "@/modules/platform/classes/classes.module.css";
export async function StudentClassDetail({
  id,
  cursor,
}: {
  id: string;
  cursor?: string;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "student") return <RoleGate expected="student" />;
  const result = await platformExtensions.classrooms.get(actor, {
    classId: id,
  });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <ClassLoadError error={result.error} />;
  }
  const classroom = result.data;
  const assignments = await platformExtensions.classrooms.listAssignments(
    actor,
    { classId: id, cursor, limit: 20 },
  );
  return (
    <>
      <Link href="/student/classes" className="back-link">
        <ArrowLeft size={15} />
        Back to my classes
      </Link>
      <PageHeading
        eyebrow={`YOUR TEACHER · ${classroom.teacherName}`}
        title={classroom.name}
        description={classroom.description || "Your class learning space."}
      />
      {classroom.status === "archived" && (
        <p className={styles.note}>
          <Info size={17} />
          This class has been archived. {classroom.archiveReason} Learning
          through this class is paused; your previous records are retained.
        </p>
      )}
      <p className={styles.note}>
        <Info size={17} />
        Each assignment keeps the course version selected by your teacher. Due
        dates are reminders; your personal courses and learning paths continue
        separately.
      </p>
      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Your course assignments</h2>
            <p>
              {classroom.assignmentCount} assigned{" "}
              {classroom.assignmentCount === 1 ? "course" : "courses"} · Learn
              at your own pace.
            </p>
          </div>
        </div>
        {assignments.ok ? (
          <>
            <AssignmentTable assignments={assignments.data.items} />
            <ClassPagination
              base={`/student/classes/${id}`}
              cursor={cursor}
              nextCursor={assignments.data.nextCursor}
              label="assignments"
            />
          </>
        ) : (
          <ClassLoadError error={assignments.error} />
        )}
      </section>
    </>
  );
}
