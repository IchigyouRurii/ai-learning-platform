import { beforeEach, describe, expect, it, vi } from "vitest";
import { toCatalogCourse } from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";

const {
  getCurrentUser,
  getWorkspace,
  getCourseCatalog,
  getOwnedCourseCatalog,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getWorkspace: vi.fn(),
  getCourseCatalog: vi.fn(),
  getOwnedCourseCatalog: vi.fn(),
}));
vi.mock("@/modules/platform", () => ({
  getCurrentUser,
  getWorkspace,
  getCourseCatalog,
  getOwnedCourseCatalog,
}));
vi.mock("@/modules/platform/components/app-shell", () => ({
  RoleGate: () => null,
}));
import { TeacherCourseList } from "@/modules/teacher/course-builder/screens/course-list";

const teacher = { id: "demo-teacher", name: "Teacher", role: "teacher" };
beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(teacher);
  getWorkspace.mockResolvedValue(createSeedState());
  getCourseCatalog.mockResolvedValue([]);
  getOwnedCourseCatalog.mockResolvedValue([]);
});
describe("teacher catalog data loading", () => {
  it("does not query private workspace data for the published marketplace", async () => {
    await TeacherCourseList({
      searchParams: Promise.resolve({ subject: "English" }),
    });
    expect(getCurrentUser).toHaveBeenCalledOnce();
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(getCourseCatalog).toHaveBeenCalledExactlyOnceWith(teacher);
  });
  it("still loads My Creation using the authenticated teacher", async () => {
    await TeacherCourseList({
      searchParams: Promise.resolve({}),
      creations: true,
    });
    expect(getOwnedCourseCatalog).toHaveBeenCalledExactlyOnceWith(teacher);
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(getCourseCatalog).not.toHaveBeenCalled();
  });
  it("shows all owned subjects and strips full lesson content from creation cards", async () => {
    const seed = createSeedState();
    getOwnedCourseCatalog.mockResolvedValue([
      toCatalogCourse(
        { ...seed.courses[0], subject: "Mathematics" },
        teacher.name,
      ),
      toCatalogCourse({ ...seed.courses[1], subject: "English" }, teacher.name),
    ]);
    const result = await TeacherCourseList({
      searchParams: Promise.resolve({ subject: "English" }),
      creations: true,
    });
    expect(
      result.props.courses.map((course: { id: string }) => course.id),
    ).toEqual([seed.courses[0].id, seed.courses[1].id]);
    expect(result.props.courses[0]).not.toHaveProperty("lessons");
  });
  it("does not load a teacher workspace for a student", async () => {
    getCurrentUser.mockResolvedValue({ ...teacher, role: "student" });
    await TeacherCourseList({
      searchParams: Promise.resolve({}),
      creations: true,
    });
    expect(getWorkspace).not.toHaveBeenCalled();
  });
});
