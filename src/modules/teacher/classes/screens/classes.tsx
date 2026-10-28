import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  ClassCards,
  ClassLoadError,
  ClassPagination,
} from "@/modules/platform/classes/common";
import { PageHeading } from "@/shared/ui/primitives";
import { ClassForm } from "../components/class-form";
export async function TeacherClasses({ cursor }: { cursor?: string }) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;
  const result = await platformExtensions.classrooms.listMine(actor, {
    limit: 12,
    cursor,
  });
  return (
    <>
      <PageHeading
        eyebrow="TEACHING MANAGEMENT"
        title="Your classes, connected."
        description="Bring students together and give every class a clear next step."
        action={<ClassForm />}
      />
      {result.ok ? (
        <>
          <ClassCards items={result.data.items} role="teacher" />
          <ClassPagination
            base="/teacher/classes"
            cursor={cursor}
            nextCursor={result.data.nextCursor}
          />
        </>
      ) : (
        <ClassLoadError error={result.error} />
      )}
    </>
  );
}
