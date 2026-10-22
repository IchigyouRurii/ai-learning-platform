"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListChecks, Send, XCircle } from "lucide-react";
import type {
  LearnerQuizQuestion,
  QuizResult,
  SafeActivity,
  Submission,
} from "@/shared/contracts";
import { submitQuizAction } from "../server/actions";

function QuestionCard({
  question,
  index,
  selected,
  onSelect,
  disabled,
}: {
  question: LearnerQuizQuestion;
  index: number;
  selected: string[];
  onSelect: (optionId: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="quiz-question">
      <legend>
        <span className="quiz-number">{index + 1}</span>
        {question.prompt}
      </legend>
      <div className="quiz-options">
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              key={option.id}
              className={`quiz-option${checked ? " selected" : ""}`}
            >
              <input
                type={question.multiple ? "checkbox" : "radio"}
                name={question.id}
                value={option.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(option.id)}
              />
              <span>{option.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QuizForm({
  courseId,
  activity,
  latest,
}: {
  courseId: string;
  activity: SafeActivity;
  latest?: Submission;
}) {
  const questions = activity.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const complete = questions.every(
    (question) => (answers[question.id]?.length ?? 0) > 0,
  );

  function select(question: LearnerQuizQuestion, optionId: string) {
    setResult(null);
    setAnswers((previous) => {
      const current = previous[question.id] ?? [];
      const next = question.multiple
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId];
      return { ...previous, [question.id]: next };
    });
  }

  return (
    <section className="activity-box quiz-box">
      <div className="activity-heading">
        <span className="activity-icon">
          <ListChecks size={18} />
        </span>
        <div>
          <p className="eyebrow">CHECK YOUR UNDERSTANDING</p>
          <h3>{activity.title}</h3>
        </div>
      </div>
      <p className="prose-text">{activity.prompt}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          startTransition(async () => {
            const response = await submitQuizAction({
              courseId,
              activityId: activity.id,
              answers: questions.map((question) => ({
                questionId: question.id,
                selectedOptionIds: answers[question.id] ?? [],
              })),
            });
            if (response.ok) {
              setResult(response.data);
              router.refresh();
            } else setError(response.error);
          });
        }}
      >
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            selected={answers[question.id] ?? []}
            onSelect={(optionId) => select(question, optionId)}
            disabled={pending || Boolean(result)}
          />
        ))}
        <div className="form-bottom">
          <span className="form-hint">
            {complete
              ? "Answers are graded on the server. You can retry after reviewing the feedback."
              : `Answer all ${questions.length} questions to submit.`}
          </span>
          <button
            className="button primary"
            disabled={pending || !complete || Boolean(result)}
            type="submit"
          >
            <Send size={14} />
            {pending ? "Grading…" : "Submit quiz"}
          </button>
        </div>
      </form>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="ai-feedback quiz-result" role="status">
          <div>
            <CheckCircle2 size={16} />
            <strong>
              Score: {result.score} / {result.maxScore}
            </strong>
          </div>
          {questions.map((question, index) => {
            const item = result.results[index];
            return (
              <p key={question.id} className="quiz-result-row">
                {item.correct ? (
                  <CheckCircle2 size={15} className="quiz-correct" />
                ) : (
                  <XCircle size={15} className="quiz-wrong" />
                )}
                <span>
                  <strong>Q{index + 1}.</strong>{" "}
                  {item.correct
                    ? "Correct."
                    : `Correct answer: ${item.correctAnswerText}.`}{" "}
                  {item.explanation}
                </span>
              </p>
            );
          })}
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
          >
            Try again
          </button>
        </div>
      )}
      {!result && latest?.aiFeedback && (
        <div className="ai-feedback" role="status">
          <div>
            <CheckCircle2 size={16} />
            <strong>Previous result</strong>
          </div>
          <p className="prose-text">{latest.aiFeedback}</p>
        </div>
      )}
    </section>
  );
}
