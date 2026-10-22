import "server-only";
import {
  courseDraftSchema,
  generationInputSchema,
  type CourseDraft,
  type GenerationInput,
} from "@/shared/contracts";
import { complete, getAIProvider } from "@/shared/ai/client";
import {
  COURSE_REPAIR_PROMPT,
  COURSE_SYSTEM_PROMPT,
  repairMessage,
} from "../prompts/generate";
import { parseGeneratedCourse } from "./parse-generated";

const MAX_TOKENS = 8000;

export async function generateCourse(
  raw: GenerationInput,
): Promise<CourseDraft> {
  const input = generationInputSchema.parse(raw);
  if (getAIProvider() === "mock") return mockCourse(input);

  const messages = [
    { role: "system" as const, content: COURSE_SYSTEM_PROMPT },
    { role: "user" as const, content: JSON.stringify(input) },
  ];
  const first = await complete(messages, true, {
    maxTokens: MAX_TOKENS,
    temperature: 0.4,
  });
  try {
    return parseGeneratedCourse(first);
  } catch (error) {
    // One same-model repair attempt. Never switch models or providers.
    const reason = error instanceof Error ? error.message : "Invalid output.";
    const repaired = await complete(
      [
        {
          role: "system",
          content: `${COURSE_SYSTEM_PROMPT}\n\n${COURSE_REPAIR_PROMPT}`,
        },
        { role: "user", content: JSON.stringify(input) },
        { role: "user", content: repairMessage(reason) },
      ],
      true,
      { maxTokens: MAX_TOKENS, temperature: 0.2 },
    );
    return parseGeneratedCourse(repaired);
  }
}

function mockCourse(input: GenerationInput): CourseDraft {
  const options = (prefix: string) =>
    ["A", "B", "C", "D"].map((label) => ({
      id: `${prefix}-${label.toLowerCase()}`,
      text: `Option ${label} about ${input.topic}`,
    }));
  const question = (index: number) => {
    const id = `q-${index}`;
    return {
      id,
      prompt: `Question ${index}: which statement best reflects the lesson on ${input.topic}?`,
      multiple: false,
      options: options(id),
      correctOptionIds: [`${id}-a`],
      explanation: `Option A is the best answer because it applies the lesson's key idea to ${input.topic}. This is a mock question generated without a live model.`,
    };
  };
  return courseDraftSchema.parse({
    title: `${input.topic}: a short course`,
    description: `A mock micro-course for ${input.audience} at ${input.difficulty} level. It exercises the full workflow without calling a live AI model.`,
    subject: input.topic,
    audience: input.audience,
    goals: (() => {
      const goals = input.goals
        .split(/[\n；;]/)
        .map((goal) => goal.trim())
        .filter(Boolean)
        .slice(0, 8);
      return goals.length ? goals : [`Understand the basics of ${input.topic}`];
    })(),
    lessons: [
      {
        id: "lesson-1",
        title: "Understand the problem",
        blocks: [
          {
            id: "text-1",
            type: "text",
            body: `This lesson introduces ${input.topic} for ${input.audience}.\n\nStart from the learner's goal: ${input.goals}\n\nA good first step is to describe the situation, the people involved, and what success would look like. This mock content is a placeholder for a live model response.`,
          },
          {
            id: "block-1",
            type: "activity",
            activity: {
              id: "activity-1",
              type: "reflection",
              title: "Connect to your own experience",
              prompt: `Describe a situation where ${input.topic} matters to you. What problem are you trying to solve?`,
              rubric:
                "Look for a concrete situation, a named problem, and a clear expected result. Feedback should ask for one specific detail.",
            },
          },
        ],
      },
      {
        id: "lesson-2",
        title: "Practice the core idea",
        blocks: [
          {
            id: "text-2",
            type: "text",
            body: `Break the problem into a small, testable step. State the conditions, propose an approach, and explain how you would check whether it worked.\n\nFor ${input.topic}, beginners often skip the validation step. Make it explicit: what evidence would show that your approach is correct?\n\nThis mock lesson deliberately keeps the content short so the workflow can be tested offline.`,
          },
        ],
      },
      {
        id: "lesson-3",
        title: "Check your understanding",
        blocks: [
          {
            id: "text-3",
            type: "text",
            body: `Review the key ideas: start from a real problem, state your assumptions, and validate the result. The quiz below checks whether you can apply these ideas to ${input.topic}.`,
          },
          {
            id: "quiz-block-1",
            type: "activity",
            activity: {
              id: "activity-quiz",
              type: "quiz",
              title: "Check your understanding",
              prompt: "Answer all five questions. Each has exactly one correct option.",
              rubric: "One point per correct answer.",
              questions: [1, 2, 3, 4, 5].map(question),
            },
          },
        ],
      },
    ],
  });
}
