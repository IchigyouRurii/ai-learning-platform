"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  Activity,
  ContentBlock,
  CourseDraft,
  Lesson,
  QuizQuestion,
} from "@/shared/contracts";
import {
  publishCourseRevisionAction,
  rewriteTextAction,
  updateCourseAction,
} from "../server/actions";

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function RewriteBox({
  courseTitle,
  lessonTitle,
  body,
  onApply,
}: {
  courseTitle: string;
  lessonTitle: string;
  body: string;
  onApply: (text: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");
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
                courseTitle,
                lessonTitle,
                body,
                instruction,
              });
              if (result.ok) {
                onApply(result.data.text);
                setInstruction("");
              } else setError(result.error);
            });
          }}
        >
          <Sparkles size={14} />
          {pending ? "Rewriting…" : "AI rewrite"}
        </button>
      </div>
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
  activity,
  courseTitle,
  lessonTitle,
  onChange,
}: {
  activity: Activity;
  courseTitle: string;
  lessonTitle: string;
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
          courseTitle={courseTitle}
          lessonTitle={lessonTitle}
          body={`${activity.prompt}\n\n${activity.rubric}`}
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

export function CourseEditor({
  courseId,
  initialContent,
  initialDraftRevision,
  publishedVersion,
  mode,
}: {
  courseId: string;
  initialContent: CourseDraft;
  initialDraftRevision: number;
  publishedVersion: number | null;
  mode: "teacher" | "student";
}) {
  const [content, setContent] = useState<CourseDraft>(initialContent);
  const [revision, setRevision] = useState(initialDraftRevision);
  const [dirty, setDirty] = useState(false);
  const [published, setPublished] = useState(publishedVersion);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
      const target = index + delta;
      if (target < 0 || target >= course.lessons.length) return course;
      const lessons = [...course.lessons];
      const [lesson] = lessons.splice(index, 1);
      lessons.splice(target, 0, lesson);
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
      ? `/teacher/courses/${courseId}`
      : `/student/courses/${courseId}`;

  return (
    <div className="course-editor">
      <section className="panel">
        <div className="section-heading">
          <h2>Course details</h2>
          <span className="form-hint">
            Draft revision {revision}
            {published !== null ? ` · Published v${published}` : " · Unpublished"}
          </span>
        </div>
        <label>
          Title
          <input
            maxLength={160}
            value={content.title}
            onChange={(event) =>
              update((course) => ({ ...course, title: event.target.value }))
            }
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            maxLength={2000}
            value={content.description}
            onChange={(event) =>
              update((course) => ({
                ...course,
                description: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Subject
          <input
            maxLength={100}
            value={content.subject}
            onChange={(event) =>
              update((course) => ({ ...course, subject: event.target.value }))
            }
          />
        </label>
        <label>
          Target audience
          <input
            maxLength={500}
            value={content.audience}
            onChange={(event) =>
              update((course) => ({ ...course, audience: event.target.value }))
            }
          />
        </label>
        <label>
          Learning goals (one per line)
          <textarea
            rows={4}
            value={content.goals.join("\n")}
            onChange={(event) =>
              update((course) => ({
                ...course,
                goals: event.target.value
                  .split("\n")
                  .map((goal) => goal.trim())
                  .filter(Boolean),
              }))
            }
          />
        </label>
      </section>

      {content.lessons.map((lesson, lessonIndex) => (
        <section className="panel lesson-editor" key={lesson.id}>
          <div className="section-heading">
            <h2>Lesson {lessonIndex + 1}</h2>
            <div className="editor-actions">
              <button
                type="button"
                className="icon-button"
                title="Move lesson up"
                aria-label="Move lesson up"
                disabled={lessonIndex === 0}
                onClick={() => moveLesson(lessonIndex, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Move lesson down"
                aria-label="Move lesson down"
                disabled={lessonIndex === content.lessons.length - 1}
                onClick={() => moveLesson(lessonIndex, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Delete lesson"
                aria-label="Delete lesson"
                disabled={content.lessons.length <= 1}
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
                    courseTitle={content.title}
                    lessonTitle={lesson.title}
                    body={block.body}
                    onApply={(text) =>
                      updateBlock(lessonIndex, blockIndex, { ...block, body: text })
                    }
                  />
                </>
              ) : block.type === "activity" ? (
                <ActivityEditor
                  activity={block.activity}
                  courseTitle={content.title}
                  lessonTitle={lesson.title}
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
                    body: "New explanation.",
                  },
                ],
              })
            }
          >
            <Plus size={14} />
            Add text block
          </button>
        </section>
      ))}

      <section className="panel editor-footer">
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            update((course) => ({
              ...course,
              lessons: [
                ...course.lessons,
                {
                  id: newId("lesson"),
                  title: `Lesson ${course.lessons.length + 1}`,
                  blocks: [
                    {
                      id: newId("text"),
                      type: "text",
                      body: "New explanation.",
                    },
                  ],
                },
              ],
            }))
          }
        >
          <Plus size={14} />
          Add lesson
        </button>
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
