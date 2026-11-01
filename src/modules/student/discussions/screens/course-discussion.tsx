import { getCurrentUser, platformExtensions } from "@/modules/platform";
import type { QuestionThread } from "@/shared/contracts";
import { DiscussionPanel } from "@/shared/ui/discussions/discussion-panel";
import {
  askQuestionAction,
  deleteQuestionAction,
  deleteReplyAction,
  replyQuestionAction,
  resolveQuestionAction,
  toggleReactionAction,
} from "../server/actions";

export async function StudentCourseDiscussion({
  courseId,
  courseVersion,
}: {
  courseId: string;
  courseVersion: number;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "student") return null;

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
  // Cap concurrency at the pool size, retaining list order and permission checks.
  for (let offset = 0; offset < list.data.items.length; offset += 5) {
    const batch = await Promise.all(
      list.data.items
        .slice(offset, offset + 5)
        .map((question) =>
          platformExtensions.discussions.getThread(actor, {
            questionId: question.id,
          }),
        ),
    );
    for (const thread of batch) if (thread.ok) threads.push(thread.data);
  }

  return (
    <DiscussionPanel
      threads={threads}
      viewer={actor}
      canAsk
      askAction={askQuestionAction.bind(null, courseId, courseVersion)}
      replyAction={replyQuestionAction.bind(null, courseId)}
      resolveAction={resolveQuestionAction.bind(null, courseId)}
      deleteQuestionAction={deleteQuestionAction.bind(null, courseId)}
      deleteReplyAction={deleteReplyAction.bind(null, courseId)}
      toggleReactionAction={toggleReactionAction.bind(null, courseId)}
    />
  );
}
