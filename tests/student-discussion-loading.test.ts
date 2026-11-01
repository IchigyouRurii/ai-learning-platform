import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  list: vi.fn(),
  thread: vi.fn(),
}));
vi.mock("@/modules/platform", () => ({
  getCurrentUser: mocks.actor,
  platformExtensions: {
    discussions: { listThreads: mocks.list, getThread: mocks.thread },
  },
}));
vi.mock("@/modules/student/discussions/server/actions", () => ({
  askQuestionAction: vi.fn(),
  deleteQuestionAction: vi.fn(),
  deleteReplyAction: vi.fn(),
  replyQuestionAction: vi.fn(),
  resolveQuestionAction: vi.fn(),
  toggleReactionAction: vi.fn(),
}));
import { StudentCourseDiscussion } from "@/modules/student/discussions/screens/course-discussion";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({
    id: "student-1",
    role: "student",
    name: "Student",
  });
});
it("starts up to five independent thread reads together and preserves discussion order", async () => {
  mocks.list.mockResolvedValue({
    ok: true,
    data: { items: Array.from({ length: 6 }, (_, i) => ({ id: `q-${i}` })) },
  });
  const resolvers: Array<() => void> = [];
  mocks.thread.mockImplementation(
    (_actor, { questionId }) =>
      new Promise((resolve) =>
        resolvers.push(() => resolve({ ok: true, data: { id: questionId } })),
      ),
  );
  const result = StudentCourseDiscussion({
    courseId: "course-1",
    courseVersion: 1,
  });
  await vi.waitFor(() => expect(mocks.thread).toHaveBeenCalledTimes(5));
  for (const resolve of resolvers.slice()) resolve();
  await vi.waitFor(() => expect(mocks.thread).toHaveBeenCalledTimes(6));
  resolvers[5]();
  expect(
    (await result)?.props.threads.map((item: { id: string }) => item.id),
  ).toEqual(Array.from({ length: 6 }, (_, i) => `q-${i}`));
});
