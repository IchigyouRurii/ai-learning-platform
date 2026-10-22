"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Save, Sparkles } from "lucide-react";
import type {
  CourseDraft,
  GenerationInput,
} from "@/shared/contracts";
import { generateCourseAction, saveCourseAction } from "../server/actions";

export function CourseGenerator({ mode }: { mode: "teacher" | "student" }) {
  const [input, setInput] = useState<GenerationInput>({
    topic: "",
    audience:
      mode === "teacher"
        ? "University students with no professional programming experience"
        : "A learner choosing this topic for self-study",
    goals: "",
    difficulty: "beginner",
    materials: "",
  });
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const update = <K extends keyof GenerationInput>(
    key: K,
    value: GenerationInput[K],
  ) => setInput((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="builder-grid">
      <section className="panel builder-input">
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div>
            <h2>
              {mode === "teacher" ? "Define your course" : "What do you want to learn?"}
            </h2>
            <p className="muted">
              {mode === "teacher"
                ? "Clear goals and materials help generate a better draft."
                : "Describe your background, goal, and available study time."}
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await generateCourseAction(input);
              if (result.ok) setDraft(result.data);
              else setError(result.error);
            });
          }}
        >
          <label>
            Course topic
            <input
              required
              minLength={2}
              maxLength={200}
              value={input.topic}
              onChange={(event) => update("topic", event.target.value)}
              placeholder="e.g. Writing requirements for an AI coding agent"
            />
          </label>
          <label>
            {mode === "teacher" ? "Target audience" : "Your background"}
            <input
              required
              minLength={2}
              maxLength={500}
              value={input.audience}
              onChange={(event) => update("audience", event.target.value)}
            />
          </label>
          <label>
            Learning goals
            <textarea
              required
              minLength={2}
              maxLength={2000}
              rows={3}
              value={input.goals}
              onChange={(event) => update("goals", event.target.value)}
              placeholder={
                mode === "teacher"
                  ? "Describe specific, measurable learning goals"
                  : "What do you want to be able to do after this course?"
              }
            />
          </label>
          <label>
            Difficulty
            <select
              value={input.difficulty}
              onChange={(event) =>
                update(
                  "difficulty",
                  event.target.value as GenerationInput["difficulty"],
                )
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            Teaching materials <span className="optional">Optional</span>
            <textarea
              maxLength={20000}
              rows={4}
              value={input.materials}
              onChange={(event) => update("materials", event.target.value)}
              placeholder={
                mode === "teacher"
                  ? "Paste lecture notes, key concepts, or reference materials"
                  : "Paste notes or links you want the course to use"
              }
            />
          </label>
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            <Sparkles size={16} />
            {pending
              ? "Generating…"
              : draft
                ? "Regenerate course"
                : "Generate course"}
          </button>
          <p className="form-hint">
            The AI produces a 3-lesson draft with a five-question quiz. Content
            requires review before publishing.
          </p>
        </form>
      </section>

      <section className="panel draft-panel">
        <div className="panel-heading">
          <span className={`step-number ${draft ? "ready" : ""}`}>
            {draft ? <Check size={15} /> : "02"}
          </span>
          <div>
            <h2>Review the draft</h2>
            <p className="muted">
              Save it, then edit the text, questions, and lesson order.
            </p>
          </div>
        </div>
        {!draft ? (
          <div className="draft-empty">
            <FileText size={38} strokeWidth={1.2} />
            <h3>Your course appears here</h3>
            <p>
              {mode === "teacher"
                ? "Enter a topic and learning goals."
                : "Describe what you want to learn."}
              <br />
              The AI draft will appear here.
            </p>
          </div>
        ) : (
          <div className="draft-editor">
            <h3>{draft.title}</h3>
            <p className="muted">{draft.description}</p>
            <p className="form-hint">
              {draft.lessons.length} lessons ·{" "}
              {draft.lessons.reduce(
                (total, lesson) =>
                  total +
                  lesson.blocks.filter((block) => block.type === "activity")
                    .length,
                0,
              )}{" "}
              activities
            </p>
            <ul className="preview-lessons">
              {draft.lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <strong>
                    Lesson {index + 1}: {lesson.title}
                  </strong>
                  <span className="muted">
                    {lesson.blocks
                      .map((block) =>
                        block.type === "text"
                          ? "Reading"
                          : block.type === "activity"
                            ? block.activity.type === "quiz"
                              ? `Quiz (${block.activity.questions?.length ?? 0} questions)`
                              : "Reflection"
                            : block.type,
                      )
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="button primary"
              disabled={pending}
              onClick={() => {
                setError("");
                startTransition(async () => {
                  const result = await saveCourseAction(draft);
                  if (!result.ok) setError(result.error);
                  else
                    router.push(
                      mode === "teacher"
                        ? `/teacher/courses/${result.data.id}`
                        : `/student/courses/${result.data.id}`,
                    );
                });
              }}
            >
              <Save size={16} />
              {pending
                ? "Saving…"
                : mode === "teacher"
                  ? "Save draft and edit"
                  : "Add to my learning"}
            </button>
            <p className="form-hint">
              {mode === "teacher"
                ? "Saving keeps this as an unpublished draft."
                : "Personal courses are visible only to you."}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
