"use client";
import {
  COURSE_INTRODUCTION_MAX_LENGTH,
  COURSE_SUBJECTS,
} from "@/shared/contracts";
import { subjectLabel } from "@/shared/ui/course-catalog";

/** Shared field order, labels and input limits for creation and author editing. */
export function CourseDetailsFields({
  subject,
  topic,
  introduction,
  goals,
  disabled = false,
  onChange,
}: {
  subject: string;
  topic: string;
  introduction: string;
  goals: string;
  disabled?: boolean;
  onChange: (
    field: "subject" | "topic" | "introduction" | "goals",
    value: string,
  ) => void;
}) {
  return (
    <>
      <label>
        Subject
        <select
          value={subjectLabel(subject, topic)}
          disabled={disabled}
          onChange={(event) => onChange("subject", event.target.value)}
        >
          {COURSE_SUBJECTS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Course topic
        <input
          required
          minLength={2}
          maxLength={160}
          value={topic}
          disabled={disabled}
          onChange={(event) => onChange("topic", event.target.value)}
          placeholder="e.g. Software engineering fundamentals"
        />
      </label>
      <label>
        Course introduction
        <textarea
          required
          minLength={2}
          maxLength={COURSE_INTRODUCTION_MAX_LENGTH}
          rows={3}
          value={introduction}
          disabled={disabled}
          onChange={(event) => onChange("introduction", event.target.value)}
          placeholder="Briefly describe what this course covers"
        />
        <span className="form-hint">
          {introduction.length}/{COURSE_INTRODUCTION_MAX_LENGTH} characters ·
          Displayed in up to two lines on course cards.
        </span>
      </label>
      <label>
        Learning goals
        <textarea
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          value={goals}
          disabled={disabled}
          onChange={(event) => onChange("goals", event.target.value)}
          placeholder="Describe specific, measurable learning goals"
        />
        <span className="form-hint">One goal per line.</span>
      </label>
    </>
  );
}
