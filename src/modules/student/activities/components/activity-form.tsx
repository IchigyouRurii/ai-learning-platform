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
  const [background, setBackground] = useState("非计算机专业，刚开始接触");
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
            我的学习背景
            <select
              value={background}
              onChange={(event) => setBackground(event.target.value)}
            >
              <option>非计算机专业，刚开始接触</option>
              <option>计算机专业，希望深入理解</option>
              <option>已有实践经验，准备求职</option>
            </select>
          </label>
          <label>
            这次想学会什么 <span className="optional">选填</span>
            <input
              maxLength={500}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="例如：把需求描述得更清楚"
            />
          </label>
        </div>
        <label>
          写下你的想法
          <textarea
            required
            minLength={10}
            maxLength={6000}
            rows={5}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="试着给出具体场景，并解释你的判断……"
          />
        </label>
        <div className="form-bottom">
          <span className="form-hint">
            提交后保存学习记录，可继续修改并重试。
          </span>
          <button className="button primary" disabled={pending} type="submit">
            <Send size={14} />
            {pending ? "正在生成反馈…" : "提交并获取反馈"}
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
            <strong>学习反馈</strong>
          </div>
          <p className="prose-text">{feedback}</p>
        </div>
      )}
    </section>
  );
}
