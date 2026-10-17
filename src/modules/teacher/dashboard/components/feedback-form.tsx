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
            setStatus("反馈已发送，学生可在「我的学习」查看。");
            setMessage("");
            router.refresh();
          } else setStatus(result.error);
        });
      }}
    >
      <label>
        给学生留一句建议
        <textarea
          required
          minLength={2}
          maxLength={2000}
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="结合学生的回答，给出具体、可执行的下一步……"
        />
      </label>
      <button className="button secondary" disabled={pending}>
        {pending ? "发送中…" : "发送反馈"}
      </button>
      {status && (
        <p className="form-hint" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
