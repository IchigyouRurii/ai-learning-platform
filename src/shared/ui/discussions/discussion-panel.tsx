"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import type {
  ActionResult,
  QuestionThread,
  ReactionKind,
  ReactionSummary,
  User,
} from "@/shared/contracts";
import { Badge } from "@/shared/ui/primitives";
import { Button } from "@/shared/ui/components/button";
import { Textarea } from "@/shared/ui/components/textarea";

type AskAction = (message: string) => Promise<ActionResult<unknown>>;
type ReplyAction = (
  questionId: string,
  message: string,
) => Promise<ActionResult<unknown>>;
type ResolveAction = (questionId: string) => Promise<ActionResult<unknown>>;
type DeleteAction = (id: string) => Promise<ActionResult<unknown>>;
type ToggleReactionAction = (
  target: { questionId?: string; replyId?: string },
  reaction: ReactionKind,
) => Promise<ActionResult<unknown>>;

const reactionOptions: {
  kind: ReactionKind;
  emoji: string;
  label: string;
}[] = [
  { kind: "like", emoji: "👍", label: "Like" },
  { kind: "smile", emoji: "😄", label: "Smile" },
  { kind: "confused", emoji: "😕", label: "Confused" },
  { kind: "doubt", emoji: "🤨", label: "Not convinced" },
];

const formatTime = (value: string) =>
  `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || "?";

function ReactionBar({
  reactions,
  target,
  toggleAction,
}: {
  reactions: ReactionSummary[];
  target: { questionId?: string; replyId?: string };
  toggleAction: ToggleReactionAction;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactionOptions.map(({ kind, emoji, label }) => {
        const summary = reactions.find((item) => item.reaction === kind);
        const count = summary?.count ?? 0;
        const active = summary?.reactedByMe ?? false;
        return (
          <button
            key={kind}
            type="button"
            disabled={pending}
            aria-pressed={active}
            aria-label={`${label} (${count})`}
            title={label}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => {
              setError("");
              startTransition(async () => {
                const result = await toggleAction(target, kind);
                if (result.ok) router.refresh();
                else setError(result.error);
              });
            }}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
      {error && (
        <span className="error-text text-xs" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function DeleteButton({
  onDelete,
}: {
  onDelete: () => Promise<ActionResult<unknown>>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  return (
    <span className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this message?")) return;
          setError("");
          startTransition(async () => {
            const result = await onDelete();
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && (
        <span className="error-text text-xs" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

function AskForm({ askAction }: { askAction: AskAction }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="mt-5 grid gap-3 rounded-[var(--ui-card-radius)] border border-border bg-muted/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!message.trim()) return;
        setStatus("");
        startTransition(async () => {
          const result = await askAction(message);
          if (result.ok) {
            setMessage("");
            setStatus("Question posted.");
            router.refresh();
          } else setStatus(result.error);
        });
      }}
    >
      <label className="grid gap-2 text-sm font-medium">
        Ask a question
        <Textarea
          required
          minLength={1}
          maxLength={6000}
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What would you like to understand better?"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="form-hint">
          Visible to everyone enrolled in this course and the teacher.
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post question"}
        </Button>
      </div>
      {status && (
        <p className="form-hint" role="status">
          {status}
        </p>
      )}
    </form>
  );
}

function ThreadCard({
  thread,
  viewer,
  replyAction,
  resolveAction,
  deleteQuestionAction,
  deleteReplyAction,
  toggleReactionAction,
}: {
  thread: QuestionThread;
  viewer: User;
  replyAction: ReplyAction;
  resolveAction: ResolveAction;
  deleteQuestionAction: DeleteAction;
  deleteReplyAction: DeleteAction;
  toggleReactionAction: ToggleReactionAction;
}) {
  const question = thread.question;
  const questionDeleted = Boolean(question.deletedAt);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const [resolving, startResolve] = useTransition();
  const router = useRouter();
  const canResolve =
    !questionDeleted &&
    question.status === "open" &&
    (viewer.role === "teacher" || viewer.id === question.author.id);

  return (
    <article className="feedback-note grid gap-4 rounded-[var(--ui-card-radius)] border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="avatar" aria-hidden="true">
            {initial(question.author.name)}
          </span>
          <div>
            <strong>{question.author.name}</strong>
            <p className="muted text-xs">
              {question.author.role === "teacher" ? "Teacher" : "Student"} ·{" "}
              {formatTime(question.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            tone={
              questionDeleted
                ? "neutral"
                : question.status === "resolved"
                  ? "green"
                  : "neutral"
            }
          >
            {questionDeleted
              ? "Deleted"
              : question.status === "resolved"
                ? "Resolved"
                : "Open"}
          </Badge>
          {!questionDeleted && viewer.id === question.author.id && (
            <DeleteButton onDelete={() => deleteQuestionAction(question.id)} />
          )}
        </div>
      </div>

      {questionDeleted ? (
        <p className="muted text-sm italic">This message was deleted.</p>
      ) : (
        <p className="prose-text whitespace-pre-wrap">{question.message}</p>
      )}

      {!questionDeleted && (
        <ReactionBar
          reactions={question.reactions}
          target={{ questionId: question.id }}
          toggleAction={toggleReactionAction}
        />
      )}

      <div className="grid gap-3">
        {thread.replies.length ? (
          thread.replies.map((reply) => {
            const replyDeleted = Boolean(reply.deletedAt);
            return (
              <div key={reply.id} className="border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <strong>{reply.author.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {reply.author.role === "teacher" ? "Teacher" : "Student"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {formatTime(reply.createdAt)}
                    </span>
                  </div>
                  {!replyDeleted && viewer.id === reply.author.id && (
                    <DeleteButton
                      onDelete={() => deleteReplyAction(reply.id)}
                    />
                  )}
                </div>
                {replyDeleted ? (
                  <p className="muted mt-1 text-sm italic">
                    This message was deleted.
                  </p>
                ) : (
                  <p className="prose-text mt-1 whitespace-pre-wrap">
                    {reply.message}
                  </p>
                )}
                {!replyDeleted && (
                  <div className="mt-2">
                    <ReactionBar
                      reactions={reply.reactions}
                      target={{ replyId: reply.id }}
                      toggleAction={toggleReactionAction}
                    />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="muted text-sm">No replies yet.</p>
        )}
      </div>

      {!questionDeleted && (
        <form
          className="grid gap-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!message.trim()) return;
            setStatus("");
            startTransition(async () => {
              const result = await replyAction(question.id, message);
              if (result.ok) {
                setMessage("");
                setStatus("Reply posted.");
                router.refresh();
              } else setStatus(result.error);
            });
          }}
        >
          <label className="grid gap-2 text-sm font-medium">
            {viewer.role === "teacher"
              ? "Reply as teacher"
              : "Answer this question"}
            <Textarea
              required
              minLength={1}
              maxLength={6000}
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Add a clear, helpful answer…"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="form-hint">
              {question.status === "resolved"
                ? "This question is resolved, but you can still reply."
                : "Your answer is visible to this course."}
            </span>
            <div className="flex gap-2">
              {canResolve && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={resolving}
                  onClick={() => {
                    setStatus("");
                    startResolve(async () => {
                      const result = await resolveAction(question.id);
                      if (result.ok) {
                        setStatus("Marked as resolved.");
                        router.refresh();
                      } else setStatus(result.error);
                    });
                  }}
                >
                  {resolving ? "Resolving…" : "Mark as resolved"}
                </Button>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Posting…" : "Reply"}
              </Button>
            </div>
          </div>
          {status && (
            <p className="form-hint" role="status">
              {status}
            </p>
          )}
        </form>
      )}
    </article>
  );
}

export function DiscussionPanel({
  threads,
  viewer,
  canAsk = false,
  askAction,
  replyAction,
  resolveAction,
  deleteQuestionAction,
  deleteReplyAction,
  toggleReactionAction,
}: {
  threads: QuestionThread[];
  viewer: User;
  canAsk?: boolean;
  askAction?: AskAction;
  replyAction: ReplyAction;
  resolveAction: ResolveAction;
  deleteQuestionAction: DeleteAction;
  deleteReplyAction: DeleteAction;
  toggleReactionAction: ToggleReactionAction;
}) {
  return (
    <section
      className="panel mt-8"
      id="course-qa"
      aria-labelledby="course-qa-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">COURSE Q&amp;A</p>
          <h2 id="course-qa-title">
            <MessageSquareText size={20} aria-hidden="true" /> Questions from
            this course
          </h2>
          <p className="muted">
            Ask a question, answer a classmate, or see the teacher&apos;s reply.
          </p>
        </div>
        <span className="catalog-count" role="status">
          {threads.length} {threads.length === 1 ? "question" : "questions"}
        </span>
      </div>

      {canAsk && askAction && <AskForm askAction={askAction} />}

      {!threads.length ? (
        <div className="empty-state">
          <MessageSquareText size={28} aria-hidden="true" />
          <h3>No questions yet</h3>
          <p className="muted">
            {canAsk
              ? "Be the first to ask something about this course."
              : "Questions will appear here after students ask them."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {threads.map((thread) => (
            <ThreadCard
              key={thread.question.id}
              thread={thread}
              viewer={viewer}
              replyAction={replyAction}
              resolveAction={resolveAction}
              deleteQuestionAction={deleteQuestionAction}
              deleteReplyAction={deleteReplyAction}
              toggleReactionAction={toggleReactionAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}
