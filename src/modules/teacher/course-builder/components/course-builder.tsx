"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Save, Sparkles } from "lucide-react";
import type { CourseDraft, GenerationInput } from "@/shared/contracts";
import { generateDraftAction, saveDraftAction } from "../server/actions";

export function CourseBuilder() {
  const [input, setInput] = useState<GenerationInput>({
    topic: "",
    audience: "没有编程基础的大学生",
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
            <h2>告诉我们你想教什么</h2>
            <p className="muted">目标越清楚，草稿越有帮助。</p>
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
            课程主题
            <input
              required
              minLength={2}
              maxLength={200}
              value={input.topic}
              onChange={(event) => update("topic", event.target.value)}
              placeholder="例如：如何向 AI 编程代理描述需求"
            />
          </label>
          <label>
            面向谁
            <input
              required
              minLength={2}
              maxLength={500}
              value={input.audience}
              onChange={(event) => update("audience", event.target.value)}
            />
          </label>
          <label>
            希望学生学会什么
            <textarea
              required
              minLength={2}
              maxLength={2000}
              rows={3}
              value={input.goals}
              onChange={(event) => update("goals", event.target.value)}
              placeholder="写出具体、可验证的学习目标"
            />
          </label>
          <label>
            你的教学材料 <span className="optional">选填</span>
            <textarea
              maxLength={20000}
              rows={5}
              value={input.materials}
              onChange={(event) => update("materials", event.target.value)}
              placeholder="粘贴讲义、知识要点或参考内容"
            />
          </label>
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            <Sparkles size={16} />
            {pending ? "正在处理…" : draft ? "重新生成草稿" : "生成课程草稿"}
          </button>
          <p className="form-hint">
            重新生成将替换当前未保存的草稿。AI 输出需要教师审核。
          </p>
        </form>
      </section>
      <section className="panel draft-panel">
        <div className="panel-heading">
          <span className={`step-number ${draft ? "ready" : ""}`}>
            {draft ? <Check size={15} /> : "02"}
          </span>
          <div>
            <h2>审核并完善草稿</h2>
            <p className="muted">加入你的教学经验，再保存。</p>
          </div>
        </div>
        {!draft ? (
          <div className="draft-empty">
            <FileText size={38} strokeWidth={1.2} />
            <h3>下一门好课，从这里开始</h3>
            <p>
              填写左侧的主题和目标，
              <br />
              课程草稿将在这里展开。
            </p>
          </div>
        ) : (
          <div className="draft-editor">
            <label>
              课程标题
              <input
                maxLength={160}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label>
              课程简介
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
                  第 {lessonIndex + 1} 节
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
                        ? "讲解内容"
                        : `活动：${block.activity.title}`}
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
              {pending ? "正在保存…" : "保存为草稿"}
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
