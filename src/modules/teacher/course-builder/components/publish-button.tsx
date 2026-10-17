"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishCourseAction } from "../server/actions";

export function PublishButton({ courseId }: { courseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        className="button primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const result = await publishCourseAction(courseId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "正在发布…" : "确认并发布课程"}
      </button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
