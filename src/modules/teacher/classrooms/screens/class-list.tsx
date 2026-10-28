import Link from "next/link";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";
import {
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { EmptyState, PageHeading } from "@/shared/ui/primitives";
import { CreateClassForm } from "../components/create-class-form";

export async function TeacherClasses() {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const [result, workspace, studentsResult] = await Promise.all([
    platformExtensions.classrooms.listMine(user, { limit: 20 }),
    getWorkspace(user),
    platformExtensions.classrooms.listStudents(user, {
      search: "",
      limit: 200,
    }),
  ]);
  const courseOptions = workspace.courses
    .filter(
      (course) =>
        course.status === "published" && course.visibility === "cohort",
    )
    .map((course) => ({ id: course.id, title: course.title }));
  const students = studentsResult.ok ? studentsResult.data.items : [];
  return (
    <>
      <PageHeading
        eyebrow="CLASSES & STUDENTS"
        title="Classes"
        description="Create classes and manage the students in each roster."
      />
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your classes</h2>
              <p className="muted">
                Only you can see and manage students in these classes.
              </p>
            </div>
          </div>
          {!result.ok ? (
            <p className="error-text" role="alert">
              {result.error}
            </p>
          ) : !result.data.items.length ? (
            <EmptyState title="No classes yet">
              Create your first class using the form.
            </EmptyState>
          ) : (
            <div className="grid gap-3">
              {result.data.items.map((classroom) => (
                <Link
                  key={classroom.id}
                  href={`/teacher/classes/${classroom.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{classroom.name}</h3>
                    <p className="muted line-clamp-2">
                      {classroom.description || "No description."}
                    </p>
                    <p className="form-hint inline-flex items-center gap-1">
                      <BookOpen size={13} />
                      {classroom.courseTitle}
                    </p>
                    <p className="form-hint inline-flex items-center gap-1">
                      <Users size={13} />
                      {classroom.memberCount}{" "}
                      {classroom.memberCount === 1 ? "student" : "students"}
                    </p>
                  </div>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="panel">
          <CreateClassForm
            courses={courseOptions}
            students={students}
            studentsError={studentsResult.ok ? "" : studentsResult.error}
          />
        </aside>
      </div>
    </>
  );
}
