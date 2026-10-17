import "server-only";
import {
  courseDraftSchema,
  generationInputSchema,
  type CourseDraft,
  type GenerationInput,
} from "@/shared/contracts";
import { complete, getAIProvider } from "@/shared/ai/client";
import { COURSE_SYSTEM_PROMPT } from "../prompts/generate";
import { parseGeneratedCourse } from "./parse-generated";

export async function generateCourse(
  raw: GenerationInput,
): Promise<CourseDraft> {
  const input = generationInputSchema.parse(raw);
  if (getAIProvider() === "mock") {
    return courseDraftSchema.parse({
      title: input.topic,
      description: `为${input.audience}准备的入门微课程。以下为模拟草稿，请教师补充准确的知识内容后发布。`,
      subject: input.topic,
      audience: input.audience,
      goals: input.goals
        .split(/[\n；;]/)
        .filter(Boolean)
        .slice(0, 8),
      lessons: [
        {
          id: "lesson-1",
          title: "认识问题与学习目标",
          blocks: [
            {
              id: "intro-1",
              type: "text",
              body: `本节围绕「${input.topic}」展开。\n\n学习目标：${input.goals}\n\n${input.materials ? `教师提供的参考材料：\n${input.materials.slice(0, 3000)}` : "请在此补充概念解释、例子与参考资料。"}\n\n这是本地模拟生成，用来验证课程制作流程，不代表真实 AI 的知识输出。`,
            },
            {
              id: "task-1",
              type: "activity",
              activity: {
                id: "activity-1",
                type: "reflection",
                title: "联系自己的场景",
                prompt: `结合自己的背景，描述一个需要运用「${input.topic}」的场景，并说明想解决什么问题。`,
                rubric:
                  "具体说明背景、问题和预期结果，反馈要鼓励学习者进一步解释。",
              },
            },
          ],
        },
        {
          id: "lesson-2",
          title: "实践与检验",
          blocks: [
            {
              id: "intro-2",
              type: "text",
              body: "把刚才的问题拆成一个可以执行的小任务。先说明条件，再提出方案，最后想一想怎样检查结果。\n\n教师可以在这里补充学科相关的操作步骤和示例。",
            },
            {
              id: "task-2",
              type: "activity",
              activity: {
                id: "activity-2",
                type: "reflection",
                title: "提出一个可验证的方案",
                prompt: "针对上一节的场景，给出你的解决步骤和验证方法。",
                rubric:
                  "关注步骤是否清楚、验证方法是否可执行；给出下一步提示。",
              },
            },
          ],
        },
      ],
    });
  }
  const result = await complete(
    [
      { role: "system", content: COURSE_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    true,
  );
  return parseGeneratedCourse(result);
}
