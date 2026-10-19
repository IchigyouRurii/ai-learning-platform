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
      description: `An introductory micro-course for ${input.audience}. This is a mock draft; the teacher must add accurate content before publishing.`,
      subject: input.topic,
      audience: input.audience,
      goals: input.goals
        .split(/[\n；;]/)
        .filter(Boolean)
        .slice(0, 8),
      lessons: [
        {
          id: "lesson-1",
          title: "Understand the problem and learning goals",
          blocks: [
            {
              id: "intro-1",
              type: "text",
              body: `This lesson explores ${input.topic}.\n\nLearning goals: ${input.goals}\n\n${input.materials ? `Teacher reference materials:\n${input.materials.slice(0, 3000)}` : "Add concept explanations, examples, and references here."}\n\nThis is a local mock draft for testing the workflow, not a response from a live AI model.`,
            },
            {
              id: "task-1",
              type: "activity",
              activity: {
                id: "activity-1",
                type: "reflection",
                title: "Connect to your own experience",
                prompt: `Describe a situation where you would use ${input.topic}, and explain the problem you want to solve.`,
                rubric:
                  "Describe the context, problem, and expected result. Feedback should encourage further explanation.",
              },
            },
          ],
        },
        {
          id: "lesson-2",
          title: "Practice and validation",
          blocks: [
            {
              id: "intro-2",
              type: "text",
              body: "Break the problem into a small actionable task. State the conditions, propose an approach, and explain how to check the result.\n\nTeachers can add subject-specific steps and examples here.",
            },
            {
              id: "task-2",
              type: "activity",
              activity: {
                id: "activity-2",
                type: "reflection",
                title: "Propose a testable approach",
                prompt:
                  "For the previous scenario, describe your steps and how you would validate the result.",
                rubric:
                  "Check that the steps are clear and validation is feasible. Suggest a next step.",
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
