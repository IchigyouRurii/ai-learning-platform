import { beforeEach, expect, it, vi } from "vitest";
const { getCurrentUser, getWorkspace, getCourseCatalog, getLearningPath } =
  vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getWorkspace: vi.fn(),
    getCourseCatalog: vi.fn(),
    getLearningPath: vi.fn(),
  }));
vi.mock("@/modules/platform", () => ({
  getCurrentUser,
  getWorkspace,
  getCourseCatalog,
  getLearningPath,
}));
vi.mock("@/modules/platform/components/app-shell", () => ({
  RoleGate: () => null,
}));
import { StudentCourseList } from "@/modules/student/learning/screens/course-list";
const student = { id: "student-1", name: "Student", role: "student" };
beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(student);
  getCourseCatalog.mockResolvedValue([]);
});
it("loads only the public metadata catalog for the authenticated student", async () => {
  const result = await StudentCourseList();
  expect(getCourseCatalog).toHaveBeenCalledExactlyOnceWith(student);
  expect(getWorkspace).not.toHaveBeenCalled();
  expect(getLearningPath).not.toHaveBeenCalled();
  expect(result.props.author).toEqual(student);
});
it("does not query student data for another role", async () => {
  getCurrentUser.mockResolvedValue({ ...student, role: "teacher" });
  await StudentCourseList();
  expect(getCourseCatalog).not.toHaveBeenCalled();
  expect(getWorkspace).not.toHaveBeenCalled();
});
