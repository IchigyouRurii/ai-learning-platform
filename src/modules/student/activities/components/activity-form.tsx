"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import type { Activity, Submission } from "@/shared/contracts";
import { submitAnswerAction } from "../server/actions";

export function ActivityForm({
  courseId,
  activity,
  latest,
}: {
  courseId: string;
  activity: Activity;
  latest?: Submission;
}) {
  const [answer, setAnswer] = useState(latest?.answer ?? "");
  const [feedback, setFeedback] = useState(latest?.aiFeedback ?? "");
  const [background, setBackground] = useState("Non-CS beginner");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <section className="activity-box">
      <div className="activity-heading">
        <span className="activity-icon">
          <MessageCircle size={18} />
        </span>
        <div>
          <p className="eyebrow">LEARN BY DOING</p>
          <h3>{activity.title}</h3>
        </div>
      </div>
      <p className="prose-text">{activity.prompt}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          startTransition(async () => {
            const result = await submitAnswerAction({
              courseId,
              activityId: activity.id,
              answer,
              background,
              goal,
            });
            if (result.ok) {
              setFeedback(result.data.feedback);
              router.refresh();
            } else setError(result.error);
          });
        }}
      >
        <div className="form-two-columns">
          <label>
            My background
            <select
              value={background}
              onChange={(event) => setBackground(event.target.value)}
            >
              <option>Non-CS beginner</option>
              <option>CS student seeking deeper understanding</option>
              <option>Experienced learner preparing for a career</option>
            </select>
          </label>
          <label>
            My learning goal <span className="optional">Optional</span>
            <input
              maxLength={500}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="e.g. Describe requirements more clearly"
            />
          </label>
        </div>
        <label>
          Your answer
          <textarea
            required
            minLength={10}
            maxLength={6000}
            rows={5}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Describe a specific situation and explain your reasoning…"
          />
        </label>
        <div className="form-bottom">
          <span className="form-hint">
            Your submission is saved. You can revise and resubmit.
          </span>
          <button className="button primary" disabled={pending} type="submit">
            <Send size={14} />
            {pending ? "Generating feedback…" : "Submit for feedback"}
          </button>
        </div>
      </form>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <div className="ai-feedback" role="status">
          <div>
            <Sparkles size={16} />
            <strong>Learning feedback</strong>
          </div>
          <p className="prose-text">{feedback}</p>
        </div>
      )}
    </section>
  );
}
