"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Route, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import type {
  Course,
  LearningPathRecord,
  LearningPathStep,
} from "@/shared/contracts";
import { generatePathAction, savePathAction } from "../server/actions";

type Draft = { title: string; steps: LearningPathStep[] };

export function LearningPathPlanner({
  courses,
  savedPath,
}: {
  courses: Pick<
    Course,
    "id" | "version" | "title" | "subject" | "description" | "lessons"
  >[];
  savedPath: LearningPathRecord | null;
}) {
  const [profile, setProfile] = useState({
    background: "University student with basic computer skills",
    goals: "",
    difficulty: "beginner" as "beginner" | "intermediate" | "advanced",
    availableMinutesPerWeek: 180,
  });
  const [draft, setDraft] = useState<Draft | null>(
    savedPath ? { title: savedPath.title, steps: savedPath.steps } : null,
  );
  const [saved, setSaved] = useState(Boolean(savedPath));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const courseById = new Map(courses.map((course) => [course.id, course]));

  return (
    <div className="builder-grid">
      <section className="panel builder-input">
        <div className="panel-heading">
          <span className="step-number">01</span>
          <div>
            <h2>Tell us about yourself</h2>
            <p className="muted">
              AI orders the published courses into a plan that fits your goal
              and time.
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            startTransition(async () => {
              const result = await generatePathAction(profile);
              if (result.ok) {
                setDraft(result.data);
                setSaved(false);
              } else setError(result.error);
            });
          }}
        >
          <label>
            Your background
            <textarea
              rows={3}
              maxLength={2000}
              required
              value={profile.background}
              onChange={(event) =>
                setProfile({ ...profile, background: event.target.value })
              }
            />
          </label>
          <label>
            Learning goals
            <textarea
              rows={3}
              maxLength={2000}
              required
              value={profile.goals}
              onChange={(event) =>
                setProfile({ ...profile, goals: event.target.value })
              }
              placeholder="e.g. Be able to write requirements for AI coding agents and review their output"
            />
          </label>
          <label>
            Preferred difficulty
            <select
              value={profile.difficulty}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  difficulty: event.target
                    .value as typeof profile.difficulty,
                })
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            Available minutes per week
            <input
              type="number"
              min={15}
              max={10080}
              required
              value={profile.availableMinutesPerWeek}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  availableMinutesPerWeek: Number(event.target.value),
                })
              }
            />
          </label>
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            <Sparkles size={16} />
            {pending ? "Planning…" : "Generate my learning path"}
          </button>
          <p className="form-hint">
            The planner only selects from the {courses.length} published courses
            currently in the catalog.
          </p>
        </form>
      </section>

      <section className="panel draft-panel">
        <div className="panel-heading">
          <span className={`step-number ${draft ? "ready" : ""}`}>
            {draft ? <Check size={15} /> : "02"}
          </span>
          <div>
            <h2>Your plan</h2>
            <p className="muted">
              Follow the steps in order. Save the plan to return to it later.
            </p>
          </div>
        </div>
        {!draft ? (
          <div className="draft-empty">
            <Route size={38} strokeWidth={1.2} />
            <h3>No plan yet</h3>
            <p>Describe your goal and available time to generate one.</p>
          </div>
        ) : (
          <div className="draft-editor">
            <h3>{draft.title}</h3>
            <ol className="path-steps">
              {draft.steps.map((step, index) => {
                const course = courseById.get(step.courseId);
                return (
                  <li key={step.courseId}>
                    <span className="path-order">{index + 1}</span>
                    <div>
                      <Link href={`/student/courses/${step.courseId}`}>
                        <strong>{course?.title ?? step.courseId}</strong>
                      </Link>
                      <p className="muted">
                        {course?.subject} · about {step.targetMinutes} minutes
                      </p>
                      <p>{step.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="editor-save">
              <button
                className="button primary"
                disabled={pending || saved}
                onClick={() => {
                  setError("");
                  setMessage("");
                  startTransition(async () => {
                    const result = await savePathAction(draft);
                    if (result.ok) {
                      setSaved(true);
                      setMessage("Learning path saved.");
                      router.refresh();
                    } else setError(result.error);
                  });
                }}
              >
                <Save size={15} />
                {saved ? "Saved" : pending ? "Saving…" : "Save learning path"}
              </button>
              <Link href="/student" className="button secondary">
                <BookOpen size={15} />
                Browse courses
              </Link>
            </div>
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success-text" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
