"use client";
import { uploadMaterial } from "./upload-material";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  FileText,
  History,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  COURSE_LEVELS,
  courseDraftSchema,
  courseLevel,
  lessonsAtLevel,
  generationInputSchema,
  type CourseDraft,
  type CourseLevel,
  type GenerationInput,
  type GenerationRecord,
} from "@/shared/contracts";
import { CourseDetailsFields } from "./course-details-fields";
import { CourseLevelTabs } from "@/shared/ui/course-level-tabs";
import {
  generateCourseLevelsAction,
  saveCourseAction,
} from "../server/actions";

export function CourseGenerator({
  mode,
  history = [],
}: {
  mode: "teacher" | "student";
  history?: GenerationRecord[];
}) {
  const [input, setInput] = useState<GenerationInput>({
    topic: "",
    subject: "Computer Science",
    description: "",
    audience: "Learners at the requested difficulty",
    goals: "",
    difficulty: "beginner",
    materials: "",
    materialIds: [],
  });
  const [uploaded, setUploaded] = useState<
    {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      extractedCharacters: number;
    }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [level, setLevel] = useState<CourseLevel>("beginner");
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const update = <K extends keyof GenerationInput>(
    key: K,
    value: GenerationInput[K],
  ) => setInput((previous) => ({ ...previous, [key]: value }));
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      try {
        const data = await uploadMaterial(file, ({ phase, percent }) =>
          setUploadStatus(
            phase === "finishing"
              ? "Finishing upload and reading file…"
              : `Uploading ${percent}%…`,
          ),
        );
        setUploaded((previous) => [...previous, data]);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : `Could not upload ${file.name}.`,
        );
      }
    }
    setUploading(false);
  }
  const lessons = draft ? lessonsAtLevel(draft.lessons, level) : [];

  async function generate(levels: readonly CourseLevel[]) {
    setError("");
    try {
      if (levels.length === 3) setDraft(null);
      setGenerating(levels.length === 3 ? "all levels" : levels[0]);
      setLevel(levels[0]);
      const batch = await generateCourseLevelsAction(
        {
          ...input,
          materialIds: uploaded.map((material) => material.id),
        },
        levels,
      );
      if (!batch.ok) {
        setError(batch.error);
        return;
      }
      const failures: string[] = [];
      for (const { level: difficulty, result } of batch.data) {
        if (!result.ok) {
          failures.push(`${difficulty}: ${result.error}`);
          continue;
        }
        setDraft((previous) => ({
          ...(previous ?? result.data),
          subject: input.subject,
          description: input.description || result.data.description,
          lessons: [
            ...(previous?.lessons.filter(
              (lesson) => courseLevel(lesson.difficulty) !== difficulty,
            ) ?? []),
            ...result.data.lessons,
          ],
        }));
      }
      if (failures.length)
        setError(`${failures.join(" ")} Completed levels have been kept.`);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <>
      <div className="builder-grid">
        <section className="panel builder-input">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div>
              <h2>
                {mode === "teacher"
                  ? "Define your course"
                  : "What do you want to learn?"}
              </h2>
              <p className="muted">
                Define one course. Generate materials for three difficulty
                levels.
              </p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(() => generate(COURSE_LEVELS));
            }}
          >
            <CourseDetailsFields
              subject={input.subject}
              topic={input.topic}
              introduction={input.description}
              goals={input.goals}
              disabled={pending}
              onChange={(field, value) => {
                if (field === "subject")
                  update("subject", value as GenerationInput["subject"]);
                else
                  update(
                    field === "introduction" ? "description" : field,
                    value,
                  );
              }}
            />
            <div className="material-upload">
              <span className="field-label">
                Attachments{" "}
                <span className="optional">PDF, DOCX, PPTX · under 5 MB</span>
              </span>
              <label className="upload-button">
                <Upload size={15} />
                {uploading
                  ? uploadStatus || "Preparing upload…"
                  : "Upload files"}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx,.txt,.md"
                  disabled={uploading || pending}
                  onChange={(event) => {
                    void uploadFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              {uploaded.length > 0 && (
                <ul className="uploaded-list">
                  {uploaded.map((material) => (
                    <li key={material.id}>
                      <FileText size={14} />
                      <span>{material.filename}</span>
                      <small>{material.extractedCharacters} chars read</small>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${material.filename}`}
                        onClick={() =>
                          setUploaded((previous) =>
                            previous.filter((item) => item.id !== material.id),
                          )
                        }
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="form-hint">
                Attached files are stored in the database. Their text is read
                server-side and used as reference material for every level.
              </p>
            </div>
            <label>
              Teaching materials <span className="optional">Optional</span>
              <textarea
                maxLength={20000}
                rows={4}
                value={input.materials}
                disabled={pending}
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
              {generating
                ? `Generating ${generating}…`
                : "Generate all three levels"}
            </button>
            <p className="form-hint">
              Each level is generated separately with its own lessons and quiz.
              Review all materials before publishing.
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
              <p className="muted">Switch levels to review their materials.</p>
            </div>
          </div>
          <CourseLevelTabs value={level} onChange={setLevel} />
          {generating && (
            <p role="status">Generating {generating} materials…</p>
          )}
          {!lessons.length ? (
            <div className="draft-empty">
              <FileText size={38} strokeWidth={1.2} />
              <h3>No {level} materials yet</h3>
              <p>Enter course details and generate the draft.</p>
            </div>
          ) : (
            <div className="draft-editor">
              <h3>{draft!.title}</h3>
              <p className="muted">{draft!.description}</p>
              <p className="form-hint">
                {lessons.length} lessons · {level}
              </p>
              <ul className="preview-lessons">
                {lessons.map((lesson, index) => (
                  <li key={lesson.id}>
                    <strong>
                      Lesson {index + 1}: {lesson.title}
                    </strong>
                    <span className="muted">
                      {lesson.blocks
                        .map((block) =>
                          block.type === "activity"
                            ? block.activity.type
                            : block.type,
                        )
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft && (
            <div className="editor-actions">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => startTransition(() => generate([level]))}
              >
                <Sparkles size={16} />
                {lessons.length ? "Regenerate" : "Generate"} {level}
              </button>
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
                          ? `/teacher/courses/${result.data.id}/edit?level=${level}`
                          : `/student/courses/${result.data.id}`,
                      );
                  });
                }}
              >
                <Save size={16} />
                Save draft and edit
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
      {history.length > 0 && (
        <section className="panel history-panel">
          <h2>
            <History size={18} /> Recent generations
          </h2>
          <p className="muted">
            Each entry contains one generated level. Restore an entry to start
            from that level.
          </p>
          <ul className="history-list">
            {history.map((record) => {
              const parsed = courseDraftSchema.safeParse(record.result);
              return (
                <li key={record.id}>
                  <strong>
                    {parsed.success ? parsed.data.title : "Course draft"}
                  </strong>
                  <button
                    className="button secondary"
                    disabled={!parsed.success || pending}
                    onClick={() => {
                      if (!parsed.success) return;
                      const restored = parsed.data;
                      const restoredLevel = courseLevel(
                        restored.lessons[0]?.difficulty,
                      );
                      setDraft(restored);
                      const savedInput = generationInputSchema.safeParse(
                        record.input,
                      );
                      if (savedInput.success) setInput(savedInput.data);
                      setLevel(restoredLevel);
                      setError("");
                    }}
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
