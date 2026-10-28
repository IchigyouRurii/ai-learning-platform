import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
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
} from "@/shared/ui/primitives";
import { DeleteClassButton } from "../components/delete-class-button";
import { RemoveMemberButton } from "../components/remove-member-button";
import { StudentPicker } from "../components/student-picker";

const SAMPLE_COMPLETION = [18, 32, 45, 57, 66, 74, 83, 91];

function sampleCompletion(classId: string, studentId: string) {
  let hash = 2166136261;
  for (const char of `${classId}:${studentId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return SAMPLE_COMPLETION[(hash >>> 0) % SAMPLE_COMPLETION.length];
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
  const [classroomResult, membersResult, studentsResult] = await Promise.all([
    platformExtensions.classrooms.get(user, { classId: id }),
    platformExtensions.classrooms.listMembers(user, { classId: id }),
    platformExtensions.classrooms.listStudents(user, {
      search: query,
      limit: 200,
    }),
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
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Student roster</h2>
              <p className="muted">
                Students added here can see this class in My Classes.
                Completion values are sample data until real submission
                tracking is connected.
              </p>
            </div>
            <Badge tone="amber">Sample data</Badge>
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
                  <TableHead>Completion (sample)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.student.id}>
                    <TableCell className="font-medium">
                      {member.student.name}
                    </TableCell>
                    <TableCell>{member.student.email}</TableCell>
                    <TableCell>
                      {new Date(member.joinedAt).toLocaleDateString("en-US", {
                        timeZone: "Asia/Shanghai",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-28">
                        <ProgressBar
                          percent={sampleCompletion(
                            classroom.id,
                            member.student.id,
                          )}
                        />
                        <span className="form-hint">
                          {sampleCompletion(classroom.id, member.student.id)}%
                        </span>
                      </div>
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
