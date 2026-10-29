"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCirclePlus, X } from "lucide-react";
import type { AnnotationCategory } from "@/shared/contracts";
import { Button } from "@/shared/ui/components/button";
import { Textarea } from "@/shared/ui/components/textarea";
import { createAnnotationAction } from "../server/actions";

const categoryOptions: { value: AnnotationCategory; label: string }[] = [
  { value: "question", label: "Question" },
  { value: "unclear", label: "Unclear" },
  { value: "possible_error", label: "Possible error" },
  { value: "outdated", label: "Outdated" },
];

export function BlockComment({
  courseId,
  courseVersion,
  lessonId,
  blockId,
}: {
  courseId: string;
  courseVersion: number;
  lessonId: string;
  blockId: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<AnnotationCategory>("question");
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function openForm() {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() ?? "";
    const block = document.querySelector(
      `[data-block-id="${CSS.escape(blockId)}"]`,
    );
    if (
      selected &&
      block &&
      selection?.anchorNode &&
      block.contains(selection.anchorNode)
    )
      setQuote(selected.slice(0, 1000));
    setOpen(true);
  }

  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="justify-self-start"
        onClick={openForm}
      >
        <MessageCirclePlus size={14} />
        Comment
      </Button>
    );

  return (
    <form
      className="grid gap-3 rounded-[var(--ui-card-radius)] border border-border bg-muted/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!message.trim()) return;
        setStatus("");
        startTransition(async () => {
          const result = await createAnnotationAction({
            courseId,
            courseVersion,
            lessonId,
            blockId,
            quote,
            category,
            message,
          });
          if (result.ok) {
            setMessage("");
            setQuote("");
            setOpen(false);
            setStatus("");
            router.refresh();
          } else setStatus(result.error);
        });
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">Ask your teacher about this part</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close comment form"
          onClick={() => setOpen(false)}
        >
          <X size={14} />
        </Button>
      </div>
      {quote && (
        <div className="flex items-start gap-2 rounded border-l-2 border-primary bg-background p-2 text-sm">
          <span className="min-w-0 flex-1 italic">“{quote}”</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Remove selected quote"
            onClick={() => setQuote("")}
          >
            <X size={12} />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor={`category-${blockId}`}>
          Type
        </label>
        <select
          id={`category-${blockId}`}
          className="rounded-[var(--ui-control-radius)] border border-input bg-transparent px-2 py-1 text-sm"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as AnnotationCategory)
          }
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        required
        maxLength={3000}
        rows={2}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What is unclear, or what might be wrong?"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="form-hint">
          Only you and your teacher can see this.
        </span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send to teacher"}
        </Button>
      </div>
      {status && (
        <p className="error-text text-xs" role="alert">
          {status}
        </p>
      )}
    </form>
  );
}
