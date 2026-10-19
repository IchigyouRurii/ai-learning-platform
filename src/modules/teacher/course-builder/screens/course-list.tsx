import { getCurrentUser, getWorkspace } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { CourseCatalog } from "../components/course-catalog";

export type CatalogSearch = {
  q?: string | string[];
  subject?: string | string[];
};
export async function TeacherCourseList({
  searchParams,
  creations = false,
}: {
  searchParams: Promise<CatalogSearch>;
  creations?: boolean;
}) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const [workspace, search] = await Promise.all([
    getWorkspace(user),
    searchParams,
  ]);
  return (
    <CourseCatalog
      courses={workspace.courses}
      author={user}
      query={typeof search.q === "string" ? search.q : ""}
      subject={typeof search.subject === "string" ? search.subject : "All"}
      creations={creations}
    />
  );
}
