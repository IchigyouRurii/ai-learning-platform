"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendFeedbackAction } from "../server/actions";

export function FeedbackForm({
  courseId,
  studentId,
}: {
  courseId: string;
  studentId: string;
}) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      className="teacher-feedback-form"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus("");
        startTransition(async () => {
          const result = await sendFeedbackAction(courseId, studentId, message);
          if (result.ok) {
            setStatus("Feedback sent. The student can view it in My Learning.");
            setMessage("");
            router.refresh();
          } else setStatus(result.error);
        });
      }}
    >
      <label>
        Feedback for the student
        <textarea
          required
          minLength={2}
          maxLength={2000}
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Suggest a specific next step based on the answer…"
        />
      </label>
      <button className="button secondary" disabled={pending}>
        {pending ? "Sending…" : "Send feedback"}
      </button>
      {status && (
        <p className="form-hint" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
