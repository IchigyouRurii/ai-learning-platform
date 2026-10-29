"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import { completeLessonAction } from "../server/actions";

export function LessonCompleteButton({
  courseId,
  courseVersion,
  lessonId,
  completed,
}: {
  courseId: string;
  courseVersion: number;
  lessonId: string;
  completed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-pressed={completed}
        title={completed ? "Click to mark lesson incomplete" : undefined}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await completeLessonAction(
              courseId,
              courseVersion,
              lessonId,
              !completed,
            );
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        {completed && <CheckCircle2 size={14} />}
        {pending ? "Saving…" : completed ? "Completed · Undo" : "Mark lesson complete"}
      </Button>
      {error && (
        <span className="error-text text-xs" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
