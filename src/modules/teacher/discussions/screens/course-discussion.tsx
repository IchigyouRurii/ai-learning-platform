import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type { QuestionThread } from "@/shared/contracts";
import { DiscussionPanel } from "@/shared/ui/discussions/discussion-panel";
import { replyQuestionAction, resolveQuestionAction } from "../server/actions";

export async function TeacherCourseDiscussion({
  courseId,
}: {
  courseId: string;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return null;

  const list = await platformExtensions.discussions.listThreads(actor, {
    courseId,
    limit: 50,
  });
  if (!list.ok)
    return (
      <p className="muted mt-6">
        Course Q&amp;A is currently unavailable. Please try again later.
      </p>
    );

  const threads: QuestionThread[] = [];
  for (const question of list.data.items) {
    const thread = await platformExtensions.discussions.getThread(actor, {
      questionId: question.id,
    });
    if (thread.ok) threads.push(thread.data);
  }

  return (
    <DiscussionPanel
      threads={threads}
      viewer={actor}
      replyAction={replyQuestionAction.bind(null, courseId)}
      resolveAction={resolveQuestionAction.bind(null, courseId)}
    />
  );
}
