import { getCurrentUser, platformExtensions } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  ClassCards,
  ClassLoadError,
  ClassPagination,
} from "@/modules/platform/classes/common";
import { PageHeading } from "@/shared/ui/primitives";
import { JoinClassDialog } from "../components/join-class";
export async function StudentClasses({ cursor }: { cursor?: string }) {
  const actor = await getCurrentUser();
  if (actor.role !== "student") return <RoleGate expected="student" />;
  const result = await platformExtensions.classrooms.listMine(actor, {
    cursor,
    limit: 12,
  });
  return (
    <>
      <PageHeading
        eyebrow="LEARN TOGETHER"
        title="My classes"
        description="Find your teacher’s course assignments and keep your next learning step in view."
        action={<JoinClassDialog />}
      />
      {result.ok ? (
        <>
          <ClassCards items={result.data.items} role="student" />
          <ClassPagination
            base="/student/classes"
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
