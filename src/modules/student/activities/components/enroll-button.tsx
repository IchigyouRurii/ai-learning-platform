"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrollAction } from "../server/actions";

export function EnrollButton({ courseId }: { courseId: string }) {
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
            const result = await enrollAction(courseId);
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
      >
        {pending ? "Enrolling…" : "Enroll and start learning"}
      </button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
