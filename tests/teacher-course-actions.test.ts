import {
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { expect, it, vi } from "vitest";
import { createSeedState } from "@/shared/database/seed";
import { PageHeading } from "@/shared/ui/primitives";
const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  document: vi.fn(),
  deletable: vi.fn(),
}));
vi.mock("@/modules/platform", () => ({
  getCurrentUser: mocks.current,
  getCourseDocumentForAuthor: mocks.document,
  canDeleteOwnedCourse: mocks.deletable,
}));
vi.mock("@/modules/platform/components/delete-course-button", () => ({
  DeleteCourseButton: () => null,
}));
import { DeleteCourseButton } from "@/modules/platform/components/delete-course-button";
import { TeacherCourseDetail } from "@/modules/teacher/course-builder/screens/course-detail";
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const result: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement<Record<string, unknown>>(child))
      result.push(child, ...nodes(child.props.children as ReactNode));
  });
  return result;
}
it("never renders Delete for teacher courses and retains Edit", async () => {
  mocks.current.mockResolvedValue({
    id: "teacher",
    role: "teacher",
    name: "Teacher",
  });
  mocks.document.mockResolvedValue({
    content: createSeedState().courses[0],
    publishedVersion: 1,
  });
  for (const deletable of [false, true]) {
    mocks.deletable.mockResolvedValue(deletable);
    const result = await TeacherCourseDetail({ id: "course-1" });
    const heading = nodes(result).find((node) => node.type === PageHeading)!;
    const actions = nodes(heading.props.action as ReactNode);
    expect(actions.some((node) => node.type === DeleteCourseButton)).toBe(
      false,
    );
    expect(
      actions.some(
        (node) =>
          node.props.href === "/teacher/courses/course-1/edit?level=beginner",
      ),
    ).toBe(true);
  }
});
