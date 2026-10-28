"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/shared/ui/primitives";
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

  if (completed)
    return (
      <Badge tone="green">
        <CheckCircle2 size={14} /> Completed
      </Badge>
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await completeLessonAction(
              courseId,
              courseVersion,
              lessonId,
            );
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        {pending ? "Saving…" : "Mark lesson complete"}
      </Button>
      {error && (
        <span className="error-text text-xs" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
