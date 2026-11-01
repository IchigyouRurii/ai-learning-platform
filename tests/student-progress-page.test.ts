import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { createSeedState } from "@/shared/database/seed";
import { getActivities } from "@/shared/contracts";
import { ProgressBar, StatCard } from "@/shared/ui/primitives";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  workspace: vi.fn(),
  catalog: vi.fn(),
  path: vi.fn(),
}));
vi.mock("@/modules/platform", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/platform/server/services")
  >("@/modules/platform/server/services");
  return {
    getCurrentUser: mocks.user,
    getWorkspace: mocks.workspace,
    getCourseCatalog: mocks.catalog,
    getLearningPath: mocks.path,
    calculateProgress: actual.calculateProgress,
  };
});
vi.mock("@/modules/platform/components/app-shell", () => ({
  RoleGate: () => null,
}));
import { StudentProgress } from "@/modules/student/progress/screens/progress";
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const result: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement<Record<string, unknown>>(child)) {
      result.push(child, ...elements(child.props.children as ReactNode));
    }
  });
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: "demo-student",
    name: "Student",
    role: "student",
  });
  mocks.catalog.mockResolvedValue([]);
  mocks.path.mockResolvedValue(null);
});
it("opens My Learning with existing enrollments and counts only the active difficulty", async () => {
  const state = createSeedState();
  const course = state.courses[0];
  mocks.workspace.mockResolvedValue({
    ...state,
    courses: [course],
    enrollments: [
      {
        studentId: "demo-student",
        courseId: course.id,
        difficulty: "advanced",
      },
    ],
    submissions: [
      {
        id: "previous",
        studentId: "demo-student",
        courseId: course.id,
        courseVersion: course.version,
        activityId: getActivities(course)[0].id,
        difficulty: "beginner",
        createdAt: "2026-11-01",
        answer: "Answer",
        aiFeedback: "Feedback",
      },
    ],
    feedback: [],
    lessonCompletions: [],
  });
  const nodes = elements(await StudentProgress());
  expect(
    nodes.find(
      (node) =>
        node.type === StatCard && node.props.label === "Enrolled courses",
    )?.props.value,
  ).toBe(1);
  expect(
    nodes.find(
      (node) =>
        node.type === StatCard && node.props.label === "Completed courses",
    )?.props.value,
  ).toBe(0);
  expect(
    nodes
      .filter((node) => node.type === ProgressBar)
      .map((node) => node.props.percent),
  ).toEqual([0]);
  expect(
    nodes.some(
      (node) =>
        node.props.href === `/student/courses/${course.id}?level=advanced`,
    ),
  ).toBe(true);
});
it("opens My Learning with a legacy enrollment lacking a difficulty field", async () => {
  const state = createSeedState();
  mocks.workspace.mockResolvedValue({
    ...state,
    feedback: [],
    submissions: [],
    lessonCompletions: [],
  });
  const nodes = elements(await StudentProgress());
  expect(
    nodes.some(
      (node) =>
        typeof node.props.href === "string" &&
        node.props.href.includes("level=beginner"),
    ),
  ).toBe(true);
});

it("separates personal creations from joined courses without duplicating automatic personal enrollments", async () => {
  const state = createSeedState();
  const joined = state.courses[0];
  const created = {
    ...state.courses[1],
    id: "personal-created",
    ownerId: "demo-student",
    visibility: "personal" as const,
  };
  const other = {
    ...state.courses[2],
    id: "other-personal",
    ownerId: "other-student",
    visibility: "personal" as const,
  };
  mocks.workspace.mockResolvedValue({
    ...state,
    courses: [joined, created, other],
    enrollments: [
      {
        courseId: joined.id,
        studentId: "demo-student",
        difficulty: "advanced",
      },
      {
        courseId: created.id,
        studentId: "demo-student",
        difficulty: "beginner",
      },
      {
        courseId: other.id,
        studentId: "other-student",
        difficulty: "beginner",
      },
    ],
    submissions: [],
    feedback: [],
    lessonCompletions: [],
  });
  const nodes = elements(await StudentProgress());
  const section = (title: string) =>
    nodes.find(
      (node) =>
        node.type === "section" &&
        elements(node.props.children as ReactNode).some(
          (child) => child.type === "h2" && child.props.children === title,
        ),
    );
  const hrefs = (title: string) =>
    elements(section(title)?.props.children as ReactNode)
      .map((node) => node.props.href)
      .filter(
        (href): href is string =>
          typeof href === "string" && href.startsWith("/student/courses/"),
      );
  expect(hrefs("My Created Courses")).toEqual([
    `/student/courses/${created.id}?level=beginner`,
    `/student/courses/${created.id}?level=beginner`,
  ]);
  expect(hrefs("My Enrolled Courses")).toEqual([
    `/student/courses/${joined.id}?level=advanced`,
    `/student/courses/${joined.id}?level=advanced`,
  ]);
  expect(
    nodes.find(
      (node) =>
        node.type === StatCard && node.props.label === "Enrolled courses",
    )?.props.value,
  ).toBe(1);
  expect(
    nodes.some(
      (node) =>
        typeof node.props.href === "string" &&
        node.props.href.includes(other.id),
    ),
  ).toBe(false);
});
