"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Route,
  Save,
  Sparkles,
  Trash2,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { MarketplaceCoursePicker } from "./course-picker";
import {
  COURSE_LEVELS,
  courseLevel,
  type CourseLevel,
  type Course,
  type Enrollment,
  type LearningPathRecord,
  type LearningPathStep,
} from "@/shared/contracts";
import {
  generatePathAction,
  savePathAction,
  enrollPathCoursesAction,
} from "../server/actions";

type Draft = { id?: string; title: string; steps: LearningPathStep[] };
type CatalogCourse = Pick<
  Course,
  "id" | "version" | "title" | "subject" | "description"
> & { levels: CourseLevel[] };
const levelName = (level: string) =>
  level.charAt(0).toUpperCase() + level.slice(1);

export function LearningPathPlanner({
  courses,
  savedPath,
  history = [],
  enrollments = [],
}: {
  courses: CatalogCourse[];
  savedPath: LearningPathRecord | null;
  history?: LearningPathRecord[];
  enrollments?: Enrollment[];
}) {
  const [editing, setEditing] = useState(false);
  const [paths, setPaths] = useState(() =>
    savedPath && !history.some((path) => path.id === savedPath.id)
      ? [savedPath, ...history]
      : history,
  );
  const [profile, setProfile] = useState({
    background: "",
    goals: "",
    difficulty: "beginner" as CourseLevel,
    availableMinutesPerWeek: 180,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});
  const [activeEnrollments, setActiveEnrollments] = useState(() =>
    Object.fromEntries(
      enrollments.map((item) => [item.courseId, courseLevel(item.difficulty)]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const byId = new Map(courses.map((course) => [course.id, course]));
  const clear = () => {
    setError("");
    setMessage("");
  };
  const openCreate = () => {
    clear();
    setDraft(null);
    setSelectedCourseIds([]);
    setEditing(true);
  };
  const edit = (path: LearningPathRecord) => {
    clear();
    setDraft({
      id: path.id,
      title: path.title,
      steps: path.steps.map((step, order) => ({
        ...step,
        order,
        difficulty: courseLevel(step.difficulty),
      })),
    });
    setEditing(true);
  };
  const changeStep = (index: number, patch: Partial<LearningPathStep>) => {
    if (draft)
      setDraft({
        ...draft,
        steps: draft.steps.map((step, i) =>
          i === index ? { ...step, ...patch } : step,
        ),
      });
  };
  const move = (index: number, delta: number) => {
    if (!draft) return;
    const steps = [...draft.steps];
    [steps[index], steps[index + delta]] = [steps[index + delta], steps[index]];
    setDraft({
      ...draft,
      steps: steps.map((step, order) => ({ ...step, order })),
    });
  };
  const enroll = (steps: LearningPathStep[]) => {
    clear();
    startTransition(async () => {
      try {
        const result = await enrollPathCoursesAction(
          steps.map((step) => ({
            courseId: step.courseId,
            difficulty: courseLevel(step.difficulty),
          })),
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const updates: Record<string, CourseLevel> = {};
        const notices: Record<string, string> = {};
        for (const outcome of result.data.outcomes) {
          notices[outcome.courseId] = outcome.message;
          if (outcome.status !== "failed")
            updates[outcome.courseId] = courseLevel(outcome.difficulty);
        }
        setActiveEnrollments((current) => ({ ...current, ...updates }));
        setResults((current) => ({ ...current, ...notices }));
        const failed = result.data.outcomes.filter(
          (item) => item.status === "failed",
        ).length;
        setMessage(
          failed
            ? `${result.data.outcomes.length - failed} courses ready; ${failed} could not be enrolled. See the course messages below.`
            : "Your courses are ready in My Learning.",
        );
        router.refresh();
      } catch {
        setError("Unable to connect. Please try again.");
      }
    });
  };
  const available = courses.filter(
    (course) => !draft?.steps.some((step) => step.courseId === course.id),
  );
  const notice = (
    <div aria-live="polite">
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-text">
          {message}
        </p>
      )}
    </div>
  );

  if (!editing)
    return (
      <div className="learning-path-page">
        <div className="section-heading">
          <p className="muted">
            {paths.length} saved {paths.length === 1 ? "path" : "paths"}
          </p>
          <button className="button primary" onClick={openCreate}>
            <Plus size={16} />
            Create Learning Path
          </button>
        </div>
        {notice}
        {paths.length === 0 ? (
          <section className="panel draft-empty">
            <Route size={40} />
            <h2>Your next goal starts here</h2>
            <p>
              Build a route from Marketplace courses. Two or three courses make
              a great start.
            </p>
            <button className="button primary" onClick={openCreate}>
              Create your first path
            </button>
          </section>
        ) : (
          paths.map((path) => (
            <section className="panel learning-path-card" key={path.id}>
              <div className="section-heading">
                <div>
                  <h2>{path.title}</h2>
                  <p className="muted">
                    {path.steps.length} courses · Learn at your own pace
                  </p>
                </div>
                <div className="path-actions">
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={() => edit(path)}
                  >
                    <Pencil size={15} />
                    Edit path
                  </button>
                  <button
                    className="button primary"
                    disabled={
                      pending ||
                      !path.steps.some(
                        (step) =>
                          byId.has(step.courseId) &&
                          !activeEnrollments[step.courseId],
                      )
                    }
                    onClick={() =>
                      enroll(
                        path.steps.filter(
                          (step) =>
                            byId.has(step.courseId) &&
                            !activeEnrollments[step.courseId],
                        ),
                      )
                    }
                  >
                    {pending ? "Enrolling…" : "Enroll in all courses"}
                  </button>
                </div>
              </div>
              <ol className="learning-route">
                {[...path.steps]
                  .sort((a, b) => a.order - b.order)
                  .map((step, index) => {
                    const course = byId.get(step.courseId);
                    const level = courseLevel(step.difficulty);
                    const active = activeEnrollments[step.courseId];
                    const current = course?.version === step.courseVersion;
                    return (
                      <li key={step.courseId} className="learning-route-stop">
                        <span className="path-order">{index + 1}</span>
                        <div className="learning-route-course">
                          <span className="badge">{levelName(level)}</span>
                          <h3>
                            {course ? (
                              <Link
                                href={`/student/courses/${course.id}?level=${level}`}
                              >
                                {course.title}
                              </Link>
                            ) : (
                              "Course unavailable"
                            )}
                          </h3>
                          <p className="muted">
                            {course?.subject} · About {step.targetMinutes}{" "}
                            minutes
                          </p>
                          <p>{course?.description}</p>
                          {!current && course && (
                            <p className="form-hint">
                              A newer version is available. Open the course to
                              review the latest content.
                            </p>
                          )}
                          {course &&
                            (active ? (
                              <Link
                                className="button secondary"
                                href={`/student/courses/${course.id}?level=${active}`}
                              >
                                Continue {levelName(active)}
                              </Link>
                            ) : (
                              <button
                                className="button primary"
                                disabled={
                                  pending || !course.levels.includes(level)
                                }
                                onClick={() => enroll([step])}
                              >
                                Enroll {levelName(level)}
                              </button>
                            ))}
                          {active && active !== level && (
                            <p className="form-hint">
                              Currently learning {levelName(active)}. Open the
                              course to switch to {levelName(level)}.
                            </p>
                          )}
                          {results[step.courseId] && (
                            <p className="form-hint" role="status">
                              {results[step.courseId]}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))
        )}
      </div>
    );

  return (
    <div className="learning-path-page">
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => {
          clear();
          setEditing(false);
        }}
      >
        <ArrowLeft size={16} />
        Back to my paths
      </button>
      <div className="builder-grid">
        <section className="panel builder-input">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Create your route</h2>
              <p className="muted">
                Tell us your goal. AI suggests two or three courses to get
                started.
              </p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              clear();
              startTransition(async () => {
                try {
                  const result = await generatePathAction({
                    ...profile,
                    courseIds: selectedCourseIds,
                  });
                  if (result.ok) setDraft(result.data);
                  else setError(result.error);
                } catch {
                  setError("Unable to generate a path. Please try again.");
                }
              });
            }}
          >
            <div className="path-course-selection">
              <h3>1. Choose the courses you want</h3>
              <MarketplaceCoursePicker
                courses={courses.filter(
                  (course) => !selectedCourseIds.includes(course.id),
                )}
                disabled={pending}
                onSelect={(id) =>
                  setSelectedCourseIds((previous) =>
                    previous.includes(id) ? previous : [...previous, id],
                  )
                }
              />
              {selectedCourseIds.length > 0 && (
                <ul className="selected-course-list">
                  {selectedCourseIds.map((id) => {
                    const selectedCourse = byId.get(id);
                    return (
                      <li key={id}>
                        <span>{selectedCourse?.title ?? id}</span>
                        <button
                          type="button"
                          className="text-button danger"
                          onClick={() =>
                            setSelectedCourseIds((previous) =>
                              previous.filter((courseId) => courseId !== id),
                            )
                          }
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="form-hint">
                Select at least one course. AI will choose one difficulty per
                selected course based on your background and goal.
              </p>
            </div>
            <h3>2. Tell us about yourself</h3>
            <label>
              Your background
              <textarea
                rows={3}
                maxLength={2000}
                minLength={2}
                required
                value={profile.background}
                onChange={(event) =>
                  setProfile({ ...profile, background: event.target.value })
                }
                placeholder="Your experience and what you already know"
              />
            </label>
            <label>
              Learning goals
              <textarea
                rows={3}
                maxLength={2000}
                minLength={2}
                required
                value={profile.goals}
                onChange={(event) =>
                  setProfile({ ...profile, goals: event.target.value })
                }
                placeholder="What would you like to achieve?"
              />
            </label>
            <label>
              Study hours per week
              <input
                type="number"
                min={0.25}
                max={168}
                step={0.25}
                required
                value={profile.availableMinutesPerWeek / 60}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    availableMinutesPerWeek: Math.round(
                      Number(event.target.value) * 60,
                    ),
                  })
                }
              />
            </label>
            <button
              className="button primary full-width"
              disabled={
                pending || !courses.length || selectedCourseIds.length < 1
              }
              type="submit"
            >
              <Sparkles size={16} />
              {pending ? "Working…" : "Generate learning path"}
            </button>
            <p className="form-hint">
              AI uses only the selected courses and assigns a difficulty to
              each. You can still adjust levels and order before saving.
            </p>
          </form>
        </section>
        <section className="panel draft-panel">
          <div className="panel-heading">
            <span className="step-number">02</span>
            <div>
              <h2>{draft?.id ? "Edit learning path" : "Review your route"}</h2>
              <p className="muted">
                Choose one difficulty per course. Add, remove, or reorder
                courses.
              </p>
            </div>
          </div>
          {draft ? (
            <div className="draft-editor">
              <label>
                Path name
                <input
                  maxLength={160}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <ol className="path-steps path-editor-steps">
                {draft.steps.map((step, index) => {
                  const course = byId.get(step.courseId);
                  return (
                    <li key={step.courseId}>
                      <span className="path-order">{index + 1}</span>
                      <div className="path-editor-course">
                        <strong>
                          {course?.title ??
                            "Course unavailable — remove this course"}
                        </strong>
                        {course && (
                          <>
                            <label>
                              Difficulty
                              <select
                                value={courseLevel(step.difficulty)}
                                onChange={(event) =>
                                  changeStep(index, {
                                    difficulty: event.target
                                      .value as CourseLevel,
                                    courseVersion: course.version,
                                  })
                                }
                              >
                                {COURSE_LEVELS.map((level) => (
                                  <option
                                    key={level}
                                    value={level}
                                    disabled={!course.levels.includes(level)}
                                  >
                                    {levelName(level)}
                                    {!course.levels.includes(level)
                                      ? " (unavailable)"
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {step.courseVersion !== course.version && (
                              <button
                                className="button secondary"
                                onClick={() =>
                                  changeStep(index, {
                                    courseVersion: course.version,
                                  })
                                }
                              >
                                Use latest course version
                              </button>
                            )}
                          </>
                        )}
                        <p className="muted">{course?.description}</p>
                        <div className="path-actions">
                          <button
                            className="button secondary"
                            aria-label={`Move ${course?.title ?? "course"} up`}
                            disabled={index === 0 || pending}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            className="button secondary"
                            aria-label={`Move ${course?.title ?? "course"} down`}
                            disabled={
                              index === draft.steps.length - 1 || pending
                            }
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button
                            className="button secondary"
                            disabled={pending}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                steps: draft.steps
                                  .filter((_, i) => i !== index)
                                  .map((item, order) => ({ ...item, order })),
                              })
                            }
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="path-add-course">
                <MarketplaceCoursePicker
                  courses={available}
                  disabled={pending}
                  onSelect={(id) => {
                    const course = byId.get(id);
                    if (
                      !course ||
                      draft.steps.some((step) => step.courseId === id)
                    )
                      return;
                    setDraft({
                      ...draft,
                      steps: [
                        ...draft.steps,
                        {
                          courseId: course.id,
                          courseVersion: course.version,
                          order: draft.steps.length,
                          difficulty: course.levels.includes(profile.difficulty)
                            ? profile.difficulty
                            : course.levels[0],
                          targetMinutes: 60,
                          reason: "Selected for your learning goal.",
                        },
                      ],
                    });
                  }}
                />
              </div>
              <button
                className="button primary"
                disabled={
                  pending ||
                  !draft.title.trim() ||
                  !draft.steps.length ||
                  draft.steps.some((step) => !byId.has(step.courseId))
                }
                onClick={() => {
                  clear();
                  startTransition(async () => {
                    try {
                      const result = await savePathAction(draft);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setPaths((current) => [
                        result.data,
                        ...current.filter((path) => path.id !== result.data.id),
                      ]);
                      setDraft(null);
                      setEditing(false);
                      setMessage("Learning path saved.");
                      router.refresh();
                    } catch {
                      setError("Unable to save your path. Please try again.");
                    }
                  });
                }}
              >
                <Save size={16} />
                {pending ? "Working…" : "Save learning path"}
              </button>
            </div>
          ) : (
            <div className="draft-empty">
              <Route size={38} />
              <h3>Your route appears here</h3>
              <p>Generate a recommendation to start planning your route.</p>
            </div>
          )}
        </section>
      </div>
      {notice}
    </div>
  );
}
