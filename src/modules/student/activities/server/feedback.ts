import "server-only";
import type { Activity, Course } from "@/shared/contracts";
import { complete, getAIProvider } from "@/shared/ai/client";
import { FEEDBACK_SYSTEM_PROMPT } from "../prompts/feedback";

export async function evaluateAnswer(
  course: Course,
  activity: Activity,
  answer: string,
  background: string,
  goal: string,
) {
  if (getAIProvider() === "mock")
    return `演示反馈（模板，未调用真实 AI）：\n\n你已经提交了自己的想法。接下来请对照任务「${activity.title}」，检查回答是否说明了具体场景和验证方法。\n\n你选择的学习背景是「${background}」${goal ? `，目标是「${goal}」` : ""}。试着补充一个与你的经历有关的例子：别人怎样判断你的方案有效？\n\n接入真实 AI 后，这里会根据回答内容提供针对性反馈。`;
  return complete([
    { role: "system", content: FEEDBACK_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        course: course.title,
        goals: course.goals,
        activity,
        answer,
        background,
        goal,
      }),
    },
  ]);
}
