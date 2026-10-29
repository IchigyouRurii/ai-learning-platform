"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContentAnnotation } from "@/shared/contracts";
import { Badge } from "@/shared/ui/primitives";
import { markAnnotationSeenAction } from "../server/actions";

export type AnnotationContext = Record<
  string,
  { lessonTitle: string; label: string }
>;

const categoryLabels = {
  question: "Question",
  unclear: "Unclear",
  possible_error: "Possible error",
  outdated: "Outdated",
} as const;

const statusLabels = {
  open: "Waiting for teacher",
  replied: "Teacher replied",
  resolved: "Resolved",
} as const;

function AnnotationItem({
  annotation,
  courseId,
  context,
}: {
  annotation: ContentAnnotation;
  courseId: string;
  context: AnnotationContext;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const unread =
    annotation.status !== "open" && annotation.studentSeenAt === null;
  const contextInfo = context[annotation.blockId];

  return (
    <details
      className="rounded-[var(--ui-card-radius)] border border-border p-3"
      onToggle={(event) => {
        if (!event.currentTarget.open || !unread || pending) return;
        startTransition(async () => {
          await markAnnotationSeenAction(courseId, annotation.id);
          router.refresh();
        });
      }}
    >
      <summary className="cursor-pointer">
        <div className="flex flex-wrap items-center gap-2">
          {unread && (
            <span
              className="size-2 rounded-full bg-destructive"
              aria-label="Unread teacher reply"
            />
          )}
          <Badge>{categoryLabels[annotation.category]}</Badge>
          <strong className="text-sm">
            {contextInfo?.label ?? "Content block"}
          </strong>
          <span className="muted text-xs">
            {contextInfo?.lessonTitle ?? ""}
          </span>
          <Badge
            tone={
              annotation.status === "resolved"
                ? "green"
                : annotation.status === "replied"
                  ? "green"
                  : "amber"
            }
          >
            {statusLabels[annotation.status]}
          </Badge>
        </div>
        {annotation.quote && (
          <p className="muted mt-1 truncate text-xs">“{annotation.quote}”</p>
        )}
      </summary>
      <div className="mt-3 grid gap-3">
        {annotation.quote && (
          <blockquote className="border-l-2 border-primary pl-3 text-sm italic">
            “{annotation.quote}”
          </blockquote>
        )}
        <p className="prose-text whitespace-pre-wrap">{annotation.message}</p>
        <div className="rounded-[var(--ui-control-radius)] bg-muted/60 p-3">
          <p className="text-sm font-medium">Teacher reply</p>
          <p className="prose-text mt-1 whitespace-pre-wrap">
            {annotation.teacherReply ??
              (annotation.status === "resolved"
                ? "Resolved without a written reply."
                : "Waiting for your teacher.")}
          </p>
        </div>
      </div>
    </details>
  );
}

export function MyAnnotations({
  courseId,
  annotations,
  context,
}: {
  courseId: string;
  annotations: ContentAnnotation[];
  context: AnnotationContext;
}) {
  const unread = annotations.filter(
    (annotation) =>
      annotation.status !== "open" && annotation.studentSeenAt === null,
  ).length;

  return (
    <section className="panel mt-6">
      <div className="panel-heading">
        <div>
          <h2>My content questions</h2>
          <p className="muted">
            Private comments to your teacher about specific course content.
          </p>
        </div>
        {unread > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-xs font-semibold text-white">
            {unread} new
          </span>
        )}
      </div>
      {!annotations.length ? (
        <p className="muted">
          Use <strong>Comment</strong> next to any content block to ask your
          teacher about it.
        </p>
      ) : (
        <div className="grid gap-3">
          {annotations.map((annotation) => (
            <AnnotationItem
              key={annotation.id}
              annotation={annotation}
              courseId={courseId}
              context={context}
            />
          ))}
        </div>
      )}
    </section>
  );
}
