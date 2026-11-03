"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  History,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  COURSE_SUBJECTS,
  courseLevel,
  editableCourseLevels,
  type CourseLevel,
} from "@/shared/contracts";
import { CourseLevelTabs } from "@/shared/ui/course-level-tabs";
import { subjectLabel } from "@/shared/ui/course-catalog";
import { CourseDetailsFields } from "./course-details-fields";
import type {
  Activity,
  ContentBlock,
  CourseDraft,
  GenerationRecord,
  Lesson,
  QuizQuestion,
} from "@/shared/contracts";
import {
  addLessonAction,
  generateCourseAction,
  publishCourseRevisionAction,
  rewriteTextAction,
  updateCourseAction,
} from "../server/actions";

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function newQuizBlock(): ContentBlock {
  const activityId = newId("quiz");
  const questions = Array.from({ length: 5 }, (_, index) => {
    const questionId = `${activityId}-q${index + 1}`;
    const options = ["A", "B", "C", "D"].map((label) => ({
      id: `${questionId}-${label.toLowerCase()}`,
      text: `Option ${label}`,
    }));
    return {
      id: questionId,
      prompt: `Question ${index + 1}`,
      multiple: false,
      options,
      correctOptionIds: [options[0].id],
      explanation: "Explain why this option is correct.",
    };
  });
  return {
    id: newId("quiz-block"),
    type: "activity",
    activity: {
      id: activityId,
      type: "quiz",
      title: "Check your understanding",
      prompt: "Answer all five questions.",
      rubric: "One point per correct answer.",
      questions,
    },
  };
}

function newReflectionBlock(): ContentBlock {
  return {
    id: newId("reflection-block"),
    type: "activity",
    activity: {
      id: newId("reflection"),
      type: "reflection",
      title: "Reflect",
      prompt: "Describe how you would apply this lesson.",
      rubric: "Look for a concrete situation and a testable next step.",
    },
  };
}

function RewriteBox({
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  blockId,
  kind,
  body,
  onApply,
}: {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  blockId: string;
  kind: "text" | "activity";
  body: string;
  onApply: (text: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<{
    before: string;
    after: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="rewrite-box">
      <div className="rewrite-controls">
        <input
          value={instruction}
          maxLength={2000}
          placeholder="Ask AI to rewrite this section (e.g. add a concrete example)"
          onChange={(event) => setInstruction(event.target.value)}
        />
        <button
          type="button"
          className="button secondary"
          disabled={pending || instruction.trim().length < 3}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const result = await rewriteTextAction({
                courseId,
                lessonId,
                blockId,
                kind,
                courseTitle,
                lessonTitle,
                body,
                instruction,
              });
              if (result.ok) {
                const before = body;
                onApply(result.data.text);
                setApplied({ before, after: result.data.text });
                setInstruction("");
              } else setError(result.error);
            });
          }}
        >
          <Sparkles size={14} />
          {pending ? "Rewriting…" : "AI rewrite"}
        </button>
      </div>
      {applied && (
        <div className="rewrite-applied" role="status">
          <p className="success-text">
            AI rewrite applied to the editor. Review it below, or undo.
          </p>
          <details>
            <summary>View the AI rewrite</summary>
            <pre>{applied.after}</pre>
          </details>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              onApply(applied.before);
              setApplied(null);
            }}
          >
            Undo this rewrite
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: QuizQuestion;
  index: number;
  onChange: (question: QuizQuestion) => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<QuizQuestion>) =>
    onChange({ ...question, ...patch });
  return (
    <div className="question-editor">
      <div className="question-editor-heading">
        <strong>Question {index + 1}</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Remove question"
          title="Remove question"
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <label>
        Question prompt
        <textarea
          rows={2}
          maxLength={2000}
          value={question.prompt}
          onChange={(event) => update({ prompt: event.target.value })}
        />
      </label>
      <div className="option-editor">
        {question.options.map((option, optionIndex) => {
          const correct = question.correctOptionIds.includes(option.id);
          return (
            <label
              key={option.id}
              className={`option-row${correct ? " correct" : ""}`}
            >
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={correct}
                onChange={() => update({ correctOptionIds: [option.id] })}
                aria-label={`Mark option ${optionIndex + 1} correct`}
              />
              <input
                value={option.text}
                maxLength={500}
                placeholder={`Option ${optionIndex + 1}`}
                onChange={(event) =>
                  update({
                    options: question.options.map((item) =>
                      item.id === option.id
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
          );
        })}
      </div>
      <label>
        Explanation for the correct answer
        <textarea
          rows={2}
          maxLength={2000}
          value={question.explanation}
          onChange={(event) => update({ explanation: event.target.value })}
        />
      </label>
    </div>
  );
}

function ActivityEditor({
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  blockId,
  activity,
  onChange,
}: {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  blockId: string;
  activity: Activity;
  onChange: (activity: Activity) => void;
}) {
  const update = (patch: Partial<Activity>) =>
    onChange({ ...activity, ...patch });
  return (
    <div className="activity-editor">
      <label>
        Activity title
        <input
          maxLength={160}
          value={activity.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <label>
        Activity prompt
        <textarea
          rows={2}
          maxLength={6000}
          value={activity.prompt}
          onChange={(event) => update({ prompt: event.target.value })}
        />
      </label>
      <label>
        Assessment notes / rubric
        <textarea
          rows={2}
          maxLength={3000}
          value={activity.rubric}
          onChange={(event) => update({ rubric: event.target.value })}
        />
      </label>
      {activity.type !== "quiz" && (
        <RewriteBox
          courseId={courseId}
          courseTitle={courseTitle}
          lessonId={lessonId}
          lessonTitle={lessonTitle}
          blockId={blockId}
          kind="activity"
          body={activity.prompt}
          onApply={(text) => update({ prompt: text })}
        />
      )}
      {activity.type === "quiz" && (
        <div className="quiz-editor">
          <div className="section-heading compact">
            <h3>Questions ({activity.questions?.length ?? 0})</h3>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const questionId = newId("q");
                const options = ["A", "B", "C", "D"].map((label) => ({
                  id: `${questionId}-${label.toLowerCase()}`,
                  text: `Option ${label}`,
                }));
                update({
                  questions: [
                    ...(activity.questions ?? []),
                    {
                      id: questionId,
                      prompt: "New question",
                      multiple: false,
                      options,
                      correctOptionIds: [options[0].id],
                      explanation: "Explain why this option is correct.",
                    },
                  ],
                });
              }}
            >
              <Plus size={14} />
              Add question
            </button>
          </div>
          {(activity.questions ?? []).map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              onChange={(next) =>
                update({
                  questions: (activity.questions ?? []).map((item) =>
                    item.id === question.id ? next : item,
                  ),
                })
              }
              onRemove={() =>
                update({
                  questions: (activity.questions ?? []).filter(
                    (item) => item.id !== question.id,
                  ),
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function rewriteRecordView(record: GenerationRecord) {
  const input =
    record.input && typeof record.input === "object"
      ? (record.input as Record<string, unknown>)
      : {};
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : {};
  return {
    blockId: typeof input.blockId === "string" ? input.blockId : null,
    instruction:
      typeof input.instruction === "string" ? input.instruction : "Rewrite",
    lessonTitle:
      typeof input.lessonTitle === "string" ? input.lessonTitle : "Lesson",
    text: typeof result.text === "string" ? result.text : null,
  };
}

export function CourseEditor({
  courseId,
  initialContent,
  initialDraftRevision,
  publishedVersion,
  mode,
  rewriteHistory = [],
}: {
  courseId: string;
  initialContent: CourseDraft;
  initialDraftRevision: number;
  publishedVersion: number | null;
  mode: "teacher" | "student";
  rewriteHistory?: GenerationRecord[];
}) {
  const [content, setContent] = useState<CourseDraft>(() => ({
    ...editableCourseLevels(initialContent),
    subject: subjectLabel(initialContent.subject, initialContent.title),
  }));
  const [goalsText, setGoalsText] = useState(initialContent.goals.join("\n"));
  const [revision, setRevision] = useState(initialDraftRevision);
  const [dirty, setDirty] = useState(
    () =>
      initialContent.lessons.every((lesson) => !lesson.difficulty) ||
      initialContent.subject !==
        subjectLabel(initialContent.subject, initialContent.title),
  );
  const [published, setPublished] = useState(publishedVersion);
  const [message, setMessage] = useState("");
  const [lessonInstruction, setLessonInstruction] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const params = useSearchParams();
  const level = courseLevel(params.get("level"));
  function selectLevel(next: CourseLevel) {
    const url = new URL(window.location.href);
    url.searchParams.set("level", next);
    window.history.pushState(null, "", url);
  }
  const visibleLessons = content.lessons
    .map((lesson, index) => ({ lesson, index }))
    .filter(({ lesson }) => courseLevel(lesson.difficulty) === level);

  function update(next: (course: CourseDraft) => CourseDraft) {
    setContent((previous) => next(previous));
    setDirty(true);
    setMessage("");
  }
  function updateLesson(index: number, lesson: Lesson) {
    update((course) => ({
      ...course,
      lessons: course.lessons.map((item, itemIndex) =>
        itemIndex === index ? lesson : item,
      ),
    }));
  }
  function updateBlock(
    lessonIndex: number,
    blockIndex: number,
    block: ContentBlock,
  ) {
    update((course) => ({
      ...course,
      lessons: course.lessons.map((lesson, index) =>
        index !== lessonIndex
          ? lesson
          : {
              ...lesson,
              blocks: lesson.blocks.map((item, itemIndex) =>
                itemIndex === blockIndex ? block : item,
              ),
            },
      ),
    }));
  }
  function moveLesson(index: number, delta: number) {
    update((course) => {
      const currentPosition = visibleLessons.findIndex(
        (item) => item.index === index,
      );
      const target = visibleLessons[currentPosition + delta]?.index ?? -1;
      if (target < 0 || target >= course.lessons.length) return course;
      const lessons = [...course.lessons];
      [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
      return { ...course, lessons };
    });
  }
  function toggleBlockType(lessonIndex: number, blockIndex: number) {
    const block = content.lessons[lessonIndex].blocks[blockIndex];
    if (block.type !== "activity") return;
    const id = block.activity.id;
    const title = block.activity.title;
    const prompt = block.activity.prompt;
    const rubric = block.activity.rubric;
    let activity: Activity;
    if (block.activity.type === "quiz") {
      activity = { id, type: "reflection", title, prompt, rubric };
    } else {
      const options = ["A", "B", "C", "D"].map((label) => ({
        id: newId("opt"),
        text: `Option ${label}`,
      }));
      activity = {
        id,
        type: "quiz",
        title: "Check your understanding",
        prompt: "Answer all questions. Each has one correct option.",
        rubric: "One point per correct answer.",
        questions: [
          {
            id: newId("q"),
            prompt: "New question",
            multiple: false,
            options,
            correctOptionIds: [options[0].id],
            explanation: "Explain why this option is correct.",
          },
        ],
      };
    }
    updateBlock(lessonIndex, blockIndex, { ...block, activity });
  }

  function applyRewrite(record: GenerationRecord) {
    const view = rewriteRecordView(record);
    if (!view.blockId || view.text === null) return;
    update((course) => ({
      ...course,
      lessons: course.lessons.map((lesson) => ({
        ...lesson,
        blocks: lesson.blocks.map((block) => {
          if (block.id !== view.blockId) return block;
          if (block.type === "text") return { ...block, body: view.text! };
          if (block.type === "activity")
            return {
              ...block,
              activity: { ...block.activity, prompt: view.text! },
            };
          return block;
        }),
      })),
    }));
  }

  function persist(): Promise<number | null> {
    if (!dirty) return Promise.resolve(revision);
    return updateCourseAction(courseId, revision, content).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setRevision(result.data.draftRevision);
      setDirty(false);
      setMessage("Draft saved.");
      return result.data.draftRevision;
    });
  }

  const detailPath =
    mode === "teacher"
      ? `/teacher/courses/${courseId}?level=${level}`
      : `/student/courses/${courseId}?level=${level}`;

  return (
    <div className="course-editor">
      <p className="form-hint">
        Edit each difficulty independently. Save and publish all levels as one
        course revision.
      </p>
      <section className="panel">
        <div className="section-heading">
          <h2>Course details</h2>
          <span className="form-hint">
            Draft revision {revision}
            {published !== null
              ? ` · Published v${published}`
              : " · Unpublished"}
          </span>
        </div>
        <CourseDetailsFields
          subject={content.subject}
          topic={content.title}
          introduction={content.description}
          goals={goalsText}
          disabled={pending}
          onChange={(field, value) => {
            if (field === "goals") setGoalsText(value);
            update((course) => ({
              ...course,
              ...(field === "topic"
                ? { title: value }
                : field === "introduction"
                  ? { description: value }
                  : field === "subject"
                    ? { subject: value }
                    : {
                        goals: value
                          .split("\n")
                          .map((goal) => goal.trim())
                          .filter(Boolean),
                      }),
            }));
          }}
        />
      </section>

      <CourseLevelTabs
        value={level}
        onChange={selectLevel}
        disabled={pending}
      />
      {!visibleLessons.length && (
        <section className="panel">
          <p>No {level} materials yet.</p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError("");
                const result = await generateCourseAction({
                  topic: content.title,
                  description: content.description,
                  subject: COURSE_SUBJECTS.includes(
                    content.subject as (typeof COURSE_SUBJECTS)[number],
                  )
                    ? (content.subject as (typeof COURSE_SUBJECTS)[number])
                    : "Other",
                  audience: content.audience,
                  goals: content.goals.join("\n"),
                  difficulty: level,
                  materials: "",
                  materialIds: (content.attachments ?? []).map(
                    (attachment) => attachment.materialId,
                  ),
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                update((course) => ({
                  ...course,
                  lessons: [...course.lessons, ...result.data.lessons],
                }));
              })
            }
          >
            Generate {level} materials
          </button>
        </section>
      )}
      {visibleLessons.map(({ lesson, index: lessonIndex }, position) => (
        <section className="panel lesson-editor" key={lesson.id}>
          <div className="section-heading">
            <h2>Lesson {position + 1}</h2>
            <div className="editor-actions">
              <button
                type="button"
                className="icon-button"
                title="Move lesson up"
                aria-label="Move lesson up"
                disabled={position === 0}
                onClick={() => moveLesson(lessonIndex, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Move lesson down"
                aria-label="Move lesson down"
                disabled={position === visibleLessons.length - 1}
                onClick={() => moveLesson(lessonIndex, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Delete lesson"
                aria-label="Delete lesson"
                disabled={visibleLessons.length <= 1}
                onClick={() =>
                  update((course) => ({
                    ...course,
                    lessons: course.lessons.filter(
                      (_, index) => index !== lessonIndex,
                    ),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <label>
            Lesson title
            <input
              maxLength={160}
              value={lesson.title}
              onChange={(event) =>
                updateLesson(lessonIndex, {
                  ...lesson,
                  title: event.target.value,
                })
              }
            />
          </label>
          {lesson.blocks.map((block, blockIndex) => (
            <div className="editor-block" key={block.id}>
              {block.type === "text" ? (
                <>
                  <label>
                    Lesson content
                    <textarea
                      rows={5}
                      maxLength={16000}
                      value={block.body}
                      onChange={(event) =>
                        updateBlock(lessonIndex, blockIndex, {
                          ...block,
                          body: event.target.value,
                        })
                      }
                    />
                  </label>
                  <RewriteBox
                    courseId={courseId}
                    courseTitle={content.title}
                    lessonId={lesson.id}
                    lessonTitle={lesson.title}
                    blockId={block.id}
                    kind="text"
                    body={block.body}
                    onApply={(text) =>
                      updateBlock(lessonIndex, blockIndex, {
                        ...block,
                        body: text,
                      })
                    }
                  />
                </>
              ) : block.type === "activity" ? (
                <ActivityEditor
                  courseId={courseId}
                  courseTitle={content.title}
                  lessonId={lesson.id}
                  lessonTitle={lesson.title}
                  blockId={block.id}
                  activity={block.activity}
                  onChange={(activity) =>
                    updateBlock(lessonIndex, blockIndex, { ...block, activity })
                  }
                />
              ) : (
                <p className="muted">Media block: {block.type}</p>
              )}
              <div className="editor-block-actions">
                {block.type === "activity" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => toggleBlockType(lessonIndex, blockIndex)}
                  >
                    Convert to{" "}
                    {block.activity.type === "quiz" ? "reflection" : "quiz"}
                  </button>
                )}
                <button
                  type="button"
                  className="text-button danger"
                  disabled={lesson.blocks.length <= 1}
                  onClick={() =>
                    updateLesson(lessonIndex, {
                      ...lesson,
                      blocks: lesson.blocks.filter(
                        (_, index) => index !== blockIndex,
                      ),
                    })
                  }
                >
                  Remove block
                </button>
              </div>
            </div>
          ))}
          <div className="block-add-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                updateLesson(lessonIndex, {
                  ...lesson,
                  blocks: [
                    ...lesson.blocks,
                    {
                      id: newId("text"),
                      type: "text",
                      body: "## New page\n\n- Add a point.\n\n---\n\n## Next page\n\n- Add another point.",
                    },
                  ],
                })
              }
            >
              <Plus size={14} />
              Add text block
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                updateLesson(lessonIndex, {
                  ...lesson,
                  blocks: [...lesson.blocks, newQuizBlock()],
                })
              }
            >
              <Plus size={14} />
              Add quiz
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                updateLesson(lessonIndex, {
                  ...lesson,
                  blocks: [...lesson.blocks, newReflectionBlock()],
                })
              }
            >
              <Plus size={14} />
              Add activity
            </button>
          </div>
        </section>
      ))}

      <section className="panel editor-footer">
        <div className="add-lesson-box">
          <input
            value={lessonInstruction}
            maxLength={2000}
            placeholder="Topic for the new lesson (AI writes 10 pages + a 5-question quiz)"
            onChange={(event) => setLessonInstruction(event.target.value)}
          />
          <button
            type="button"
            className="button secondary"
            disabled={pending || lessonInstruction.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                setError("");
                setMessage("");
                const revisionToUse = dirty ? await persist() : revision;
                if (revisionToUse === null) return;
                const result = await addLessonAction({
                  courseId,
                  expectedDraftRevision: revisionToUse,
                  level,
                  instruction: lessonInstruction,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setContent(result.data.document.content);
                setRevision(result.data.document.draftRevision);
                setDirty(false);
                setLessonInstruction("");
                setMessage(
                  "A new 10-page lesson with a five-question quiz was generated.",
                );
              })
            }
          >
            <Sparkles size={14} />
            Add lesson with AI
          </button>
        </div>
        <div className="editor-save">
          <button
            type="button"
            className="button secondary"
            disabled={pending || !dirty}
            onClick={() =>
              startTransition(async () => {
                setError("");
                await persist();
              })
            }
          >
            <Save size={15} />
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError("");
                const saved = await persist();
                if (saved === null) return;
                const result = await publishCourseRevisionAction(courseId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setPublished(result.data.version);
                setMessage(`Published version ${result.data.version}.`);
                router.push(detailPath);
                router.refresh();
              })
            }
          >
            <Check size={15} />
            {pending
              ? "Publishing…"
              : published === null
                ? "Publish course"
                : "Publish new version"}
          </button>
        </div>
      </section>
      <p className="form-hint">
        Published versions are immutable. Saving changes creates a new draft
        revision; publishing adds a new snapshot.
      </p>
      {rewriteHistory.length > 0 && (
        <section className="panel history-panel">
          <div className="section-heading">
            <div>
              <h2>
                <History size={18} />
                AI rewrite history
              </h2>
              <p className="muted">
                Every rewrite request is saved. Apply an older result to the
                matching block.
              </p>
            </div>
          </div>
          <ul className="history-list">
            {rewriteHistory.map((record) => {
              const view = rewriteRecordView(record);
              return (
                <li key={record.id}>
                  <div>
                    <strong>{view.instruction}</strong>
                    <small>
                      {view.lessonTitle} ·{" "}
                      {new Date(record.createdAt).toLocaleString("en-US", {
                        timeZone: "Asia/Shanghai",
                      })}
                    </small>
                    {view.text && (
                      <p className="muted">
                        {view.text.slice(0, 180)}
                        {view.text.length > 180 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={!view.blockId || view.text === null}
                    onClick={() => applyRewrite(record)}
                  >
                    Apply
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {message && (
        <p className="success-text" role="status">
          {message}
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
