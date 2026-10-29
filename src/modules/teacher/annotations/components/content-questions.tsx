"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContentAnnotation } from "@/shared/contracts";
import { Badge } from "@/shared/ui/primitives";
import { Button } from "@/shared/ui/components/button";
import { Textarea } from "@/shared/ui/components/textarea";
import {
  replyAnnotationAction,
  resolveAnnotationAction,
} from "../server/actions";

type AnnotationContext = Record<string, { lessonTitle: string; label: string }>;

const categoryLabels = {
  question: "Question",
  unclear: "Unclear",
  possible_error: "Possible error",
  outdated: "Outdated",
} as const;

const statusLabels = {
  open: "Unprocessed",
  replied: "Replied",
  resolved: "Resolved",
} as const;

function AnnotationItem({
  courseId,
  annotation,
  context,
}: {
  courseId: string;
  annotation: ContentAnnotation;
  context: AnnotationContext;
}) {
  const [replying, startReply] = useTransition();
  const [resolving, startResolve] = useTransition();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const contextInfo = context[annotation.blockId];
  const open = annotation.status === "open";

  return (
    <div className="rounded-[var(--ui-card-radius)] border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {open && (
          <span
            className="size-2 rounded-full bg-destructive"
            aria-label="Unprocessed"
          />
        )}
        <Badge>{categoryLabels[annotation.category]}</Badge>
        <strong className="text-sm">
          {contextInfo?.label ?? "Content block"}
        </strong>
        <span className="muted text-xs">{contextInfo?.lessonTitle ?? ""}</span>
        <Badge
          tone={
            annotation.status === "resolved"
              ? "green"
              : open
                ? "amber"
                : "green"
          }
        >
          {statusLabels[annotation.status]}
        </Badge>
      </div>
      {annotation.quote && (
        <blockquote className="mt-2 border-l-2 border-primary pl-3 text-sm italic">
          “{annotation.quote}”
        </blockquote>
      )}
      <p className="prose-text mt-2 whitespace-pre-wrap">
        {annotation.message}
      </p>
      {annotation.teacherReply && (
        <div className="mt-3 rounded-[var(--ui-control-radius)] bg-muted/60 p-3">
          <p className="text-sm font-medium">Your reply</p>
          <p className="prose-text mt-1 whitespace-pre-wrap">
            {annotation.teacherReply}
          </p>
        </div>
      )}
      {annotation.status === "resolved" ? (
        <p className="form-hint mt-2">
          Resolved
          {annotation.teacherReply
            ? " with a reply."
            : " without a written reply."}
        </p>
      ) : (
        <div className="mt-3 grid gap-2 border-t border-border pt-3">
          <Textarea
            rows={2}
            maxLength={3000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Reply to this question…"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="form-hint">
              Reply clears this item from your unprocessed count.
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resolving}
                onClick={() => {
                  setError("");
                  startResolve(async () => {
                    const result = await resolveAnnotationAction(
                      courseId,
                      annotation.id,
                    );
                    if (result.ok) router.refresh();
                    else setError(result.error);
                  });
                }}
              >
                {resolving ? "Resolving…" : "Resolve"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={replying || !message.trim()}
                onClick={() => {
                  setError("");
                  startReply(async () => {
                    const result = await replyAnnotationAction(
                      courseId,
                      annotation.id,
                      message,
                    );
                    if (result.ok) {
                      setMessage("");
                      router.refresh();
                    } else setError(result.error);
                  });
                }}
              >
                {replying ? "Replying…" : "Reply"}
              </Button>
            </div>
          </div>
          {error && (
            <p className="error-text text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      <Link
        href={`/teacher/courses/${courseId}#course-qa`}
        className="text-link mt-3 inline-block text-sm"
      >
        Open course Q&A to post a correction →
      </Link>
    </div>
  );
}

export function ContentQuestions({
  courseId,
  annotations,
  context,
}: {
  courseId: string;
  annotations: ContentAnnotation[];
  context: AnnotationContext;
}) {
  if (!annotations.length) return null;
  const openCount = annotations.filter(
    (annotation) => annotation.status === "open",
  ).length;

  return (
    <section className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3>Content questions</h3>
        {openCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-xs font-semibold text-white">
            {openCount} unprocessed
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-3">
        {annotations.map((annotation) => (
          <AnnotationItem
            key={annotation.id}
            courseId={courseId}
            annotation={annotation}
            context={context}
          />
        ))}
      </div>
    </section>
  );
}
