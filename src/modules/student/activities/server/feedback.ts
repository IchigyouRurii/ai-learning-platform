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
    return `Demo feedback (template; no live AI request):\n\nYou have submitted your ideas. Review the activity "${activity.title}" and check whether your answer describes a specific situation and a way to validate your approach.\n\nYour background is "${background}"${goal ? ` and your goal is "${goal}"` : ""}. Add an example from your experience: how could someone check whether your approach works?\n\nA live AI provider can give feedback tailored to your answer.`;

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
