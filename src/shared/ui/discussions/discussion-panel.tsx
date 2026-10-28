"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import type { ActionResult, QuestionThread, User } from "@/shared/contracts";
import { Badge } from "@/shared/ui/primitives";
import { Button } from "@/shared/ui/components/button";
import { Textarea } from "@/shared/ui/components/textarea";

type AskAction = (message: string) => Promise<ActionResult<unknown>>;
type ReplyAction = (
  questionId: string,
  message: string,
) => Promise<ActionResult<unknown>>;
type ResolveAction = (questionId: string) => Promise<ActionResult<unknown>>;

const formatTime = (value: string) =>
  `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || "?";

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
}: {
  thread: QuestionThread;
  viewer: User;
  replyAction: ReplyAction;
  resolveAction: ResolveAction;
}) {
  const question = thread.question;
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const [resolving, startResolve] = useTransition();
  const router = useRouter();
  const canResolve =
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
        <Badge tone={question.status === "resolved" ? "green" : "neutral"}>
          {question.status === "resolved" ? "Resolved" : "Open"}
        </Badge>
      </div>

      <p className="prose-text whitespace-pre-wrap">{question.message}</p>

      <div className="grid gap-3">
        {thread.replies.length ? (
          thread.replies.map((reply) => (
            <div key={reply.id} className="border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <strong>{reply.author.name}</strong>
                <span className="text-xs text-muted-foreground">
                  {reply.author.role === "teacher" ? "Teacher" : "Student"}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {formatTime(reply.createdAt)}
                </span>
              </div>
              <p className="prose-text mt-1 whitespace-pre-wrap">
                {reply.message}
              </p>
            </div>
          ))
        ) : (
          <p className="muted text-sm">No replies yet.</p>
        )}
      </div>

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
}: {
  threads: QuestionThread[];
  viewer: User;
  canAsk?: boolean;
  askAction?: AskAction;
  replyAction: ReplyAction;
  resolveAction: ResolveAction;
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
            />
          ))}
        </div>
      )}
    </section>
  );
}
