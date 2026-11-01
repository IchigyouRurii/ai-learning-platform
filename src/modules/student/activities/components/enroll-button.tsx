"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourseLevel } from "@/shared/contracts";
import { enrollAction, switchDifficultyAction } from "../server/actions";

export function EnrollButton({
  courseId,
  level = "beginner",
  activeLevel = null,
  version = 1,
}: {
  courseId: string;
  level?: CourseLevel;
  activeLevel?: CourseLevel | null;
  version?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const name = level[0].toUpperCase() + level.slice(1);
  return (
    <div>
      <button
        className="button primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const result = activeLevel
              ? await switchDifficultyAction(
                  courseId,
                  activeLevel,
                  level,
                  version,
                )
              : await enrollAction(courseId, level);
            if (result.ok) {
              router.replace(`/student/courses/${courseId}?level=${level}`, {
                scroll: false,
              });
              router.refresh();
            } else setError(result.error);
          })
        }
      >
        {pending
          ? "Saving…"
          : activeLevel
            ? `Switch to ${name}`
            : `Enroll ${name}`}
      </button>
      {activeLevel && (
        <p className="form-hint">
          Your progress at other difficulties will be saved.
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
