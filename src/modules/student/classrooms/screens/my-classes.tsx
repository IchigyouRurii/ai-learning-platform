import Link from "next/link";
import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { Badge, EmptyState, PageHeading } from "@/shared/ui/primitives";

export async function StudentClasses() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const result = await platformExtensions.classrooms.listMine(user, {
    limit: 20,
  });
  return (
    <>
      <PageHeading
        eyebrow="MY CLASSES"
        title="Your classes"
        description="Classes your teachers have added you to."
      />
      {!result.ok ? (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      ) : !result.data.items.length ? (
        <EmptyState title="No classes yet">
          Your class will appear here after a teacher adds you.
        </EmptyState>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {result.data.items.map((classroom) => (
            <article className="panel" key={classroom.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2>{classroom.name}</h2>
                  <p className="muted">
                    {classroom.description || "No description."}
                  </p>
                </div>
                <Badge>
                  {classroom.memberCount}{" "}
                  {classroom.memberCount === 1 ? "student" : "students"}
                </Badge>
              </div>
              <p className="form-hint">
                Course:{" "}
                <Link href={`/student/courses/${classroom.courseId}`}>
                  {classroom.courseTitle}
                </Link>
              </p>
              <p className="form-hint">
                Created{" "}
                {new Date(classroom.createdAt).toLocaleDateString("en-US", {
                  timeZone: "Asia/Shanghai",
                })}
              </p>
              <Link
                href={`/student/classes/${classroom.id}`}
                className="text-link"
              >
                View class details →
              </Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
