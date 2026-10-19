"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Save, Sparkles } from "lucide-react";
import type { CourseDraft, GenerationInput } from "@/shared/contracts";
import { generateDraftAction, saveDraftAction } from "../server/actions";

export function CourseBuilder() {
  const [input, setInput] = useState<GenerationInput>({
    topic: "",
    audience: "University students with no programming experience",
    goals: "",
    materials: "",
  });
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const update = (key: keyof GenerationInput, value: string) =>
    setInput((previous) => ({ ...previous, [key]: value }));
  function editBlock(lessonIndex: number, blockIndex: number, value: string) {
    setDraft(
      (previous) =>
        previous && {
          ...previous,
          lessons: previous.lessons.map((lesson, index) =>
            index !== lessonIndex
              ? lesson
              : {
                  ...lesson,
                  blocks: lesson.blocks.map((block, index) =>
                    index !== blockIndex
                      ? block
                      : block.type === "text"
                        ? { ...block, body: value }
                        : block.type === "activity"
                          ? {
                              ...block,
                              activity: { ...block.activity, prompt: value },
                            }
                          : block,
                  ),
                },
          ),
        },
    );
  }
  return (
    <div className="builder-grid">
      <section className="panel builder-input">
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div>
            <h2>Define your course</h2>
            <p className="muted">Clear goals help generate better drafts.</p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await generateDraftAction(input);
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
            Target audience
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
              placeholder="Describe specific, measurable learning goals"
            />
          </label>
          <label>
            Teaching materials <span className="optional">Optional</span>
            <textarea
              maxLength={20000}
              rows={5}
              value={input.materials}
              onChange={(event) => update("materials", event.target.value)}
              placeholder="Paste lecture notes, key concepts, or reference materials"
            />
          </label>
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            <Sparkles size={16} />
            {pending
              ? "Processing…"
              : draft
                ? "Regenerate draft"
                : "Generate course draft"}
          </button>
          <p className="form-hint">
            Regenerating replaces the unsaved draft. AI content requires teacher
            review.
          </p>
        </form>
      </section>
      <section className="panel draft-panel">
        <div className="panel-heading">
          <span className={`step-number ${draft ? "ready" : ""}`}>
            {draft ? <Check size={15} /> : "02"}
          </span>
          <div>
            <h2>Review and refine</h2>
            <p className="muted">Add your expertise before saving.</p>
          </div>
        </div>
        {!draft ? (
          <div className="draft-empty">
            <FileText size={38} strokeWidth={1.2} />
            <h3>Your next course starts here</h3>
            <p>
              Enter a topic and learning goals.
              <br />
              Your course draft will appear here.
            </p>
          </div>
        ) : (
          <div className="draft-editor">
            <label>
              Course title
              <input
                maxLength={160}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label>
              Course description
              <textarea
                rows={3}
                maxLength={2000}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </label>
            {draft.lessons.map((lesson, lessonIndex) => (
              <div className="lesson-editor" key={lesson.id}>
                <label>
                  Lesson {lessonIndex + 1}
                  <input
                    value={lesson.title}
                    maxLength={160}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        lessons: draft.lessons.map((item, index) =>
                          index === lessonIndex
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                {lesson.blocks.map((block, blockIndex) =>
                  block.type === "text" || block.type === "activity" ? (
                    <label key={block.id}>
                      {block.type === "text"
                        ? "Lesson content"
                        : `Activity: ${block.activity.title}`}
                      <textarea
                        rows={block.type === "text" ? 5 : 3}
                        value={
                          block.type === "text"
                            ? block.body
                            : block.activity.prompt
                        }
                        onChange={(event) =>
                          editBlock(lessonIndex, blockIndex, event.target.value)
                        }
                      />
                    </label>
                  ) : null,
                )}
              </div>
            ))}
            <button
              className="button primary"
              disabled={pending}
              onClick={() => {
                setError("");
                startTransition(async () => {
                  const result = await saveDraftAction(draft);
                  if (!result.ok) setError(result.error);
                  else router.push(`/teacher/courses/${result.data.id}`);
                });
              }}
            >
              <Save size={16} />
              {pending ? "Saving…" : "Save draft"}
            </button>
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
