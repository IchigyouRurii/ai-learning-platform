import "server-only";
import {
  courseDraftSchema,
  courseLevel,
  generationInputSchema,
  type ContentBlock,
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

const MAX_TOKENS = 6000;
const GENERATION_TIMEOUT_MS = 240000;
const PAGES_PER_LESSON = 10;
const QUESTIONS_PER_LESSON = 5;

export function splitMarkdownPages(body: string) {
  return body
    .split(/\n\s*---\s*\n/)
    .map((page) => page.trim())
    .filter(Boolean);
}

function assertCourseStructure(course: CourseDraft) {
  for (const lesson of course.lessons) {
    const text = lesson.blocks.find(
      (block): block is Extract<ContentBlock, { type: "text" }> =>
        block.type === "text",
    );
    const quiz = lesson.blocks.find(
      (block): block is Extract<ContentBlock, { type: "activity" }> =>
        block.type === "activity" && block.activity.type === "quiz",
    );
    if (!text)
      throw new Error(`Lesson ${lesson.id} needs a text block with pages.`);
    if (splitMarkdownPages(text.body).length !== PAGES_PER_LESSON)
      throw new Error(
        `Lesson ${lesson.id} must contain exactly ${PAGES_PER_LESSON} Markdown pages separated by ---.`,
      );
    if (!quiz)
      throw new Error(`Lesson ${lesson.id} needs exactly one quiz activity.`);
    if ((quiz.activity.questions?.length ?? 0) !== QUESTIONS_PER_LESSON)
      throw new Error(
        `Lesson ${lesson.id} quiz must contain exactly ${QUESTIONS_PER_LESSON} questions.`,
      );
  }
  return course;
}

export async function generateCourse(
  raw: Omit<GenerationInput, "subject" | "description" | "materialIds"> &
    Partial<Pick<GenerationInput, "subject" | "description" | "materialIds">>,
): Promise<CourseDraft> {
  const input = generationInputSchema.parse(raw);
  const draft = await generateSingleCourse(input);
  const difficulty = courseLevel(
    input.difficulty === "intermediate" ? "advanced" : input.difficulty,
  );
  // The server assigns level and globally unique IDs, never trusting model labels.
  return courseDraftSchema.parse({
    ...draft,
    subject: input.subject,
    description: input.description || draft.description,
    lessons: draft.lessons.map((lesson) => ({
      ...lesson,
      difficulty,
      id: `${difficulty}:${lesson.id}`,
      blocks: lesson.blocks.map((block) =>
        block.type !== "activity"
          ? { ...block, id: `${difficulty}:${block.id}` }
          : {
              ...block,
              id: `${difficulty}:${block.id}`,
              activity: {
                ...block.activity,
                id: `${difficulty}:${block.activity.id}`,
                ...(block.activity.questions
                  ? {
                      questions: block.activity.questions.map((q) => ({
                        ...q,
                        id: `${difficulty}:${q.id}`,
                        options: q.options.map((o) => ({
                          ...o,
                          id: `${difficulty}:${o.id}`,
                        })),
                        correctOptionIds: q.correctOptionIds.map(
                          (id) => `${difficulty}:${id}`,
                        ),
                      })),
                    }
                  : {}),
              },
            },
      ),
    })),
  });
}

async function generateSingleCourse(
  raw: GenerationInput,
): Promise<CourseDraft> {
  const input = generationInputSchema.parse(raw);
  if (getAIProvider() === "mock") return assertCourseStructure(mockCourse(input));

  const messages = [
    { role: "system" as const, content: COURSE_SYSTEM_PROMPT },
    { role: "user" as const, content: JSON.stringify(input) },
  ];
  const first = await complete(messages, true, {
    maxTokens: MAX_TOKENS,
    temperature: 0.4,
    timeoutMs: GENERATION_TIMEOUT_MS,
  });
  try {
    return assertCourseStructure(parseGeneratedCourse(first));
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
      {
        maxTokens: MAX_TOKENS,
        temperature: 0.2,
        timeoutMs: GENERATION_TIMEOUT_MS,
      },
    );
    return assertCourseStructure(parseGeneratedCourse(repaired));
  }
}

export function pageMarkdown(topic: string, lessonNumber: number) {
  return Array.from({ length: PAGES_PER_LESSON }, (_, index) => {
    const page = index + 1;
    return [
      `## ${topic}: part ${page}`,
      "",
      `- Key idea ${page} for lesson ${lessonNumber}.`,
      "- A short explanation of why it matters.",
      "- One concrete example to remember.",
    ].join("\n");
  }).join("\n\n---\n\n");
}

function mockCourse(input: GenerationInput): CourseDraft {
  const lessons = [1, 2, 3].map((lessonNumber) => {
    const lessonId = `lesson-${lessonNumber}`;
    const questions = Array.from(
      { length: QUESTIONS_PER_LESSON },
      (_, index) => {
        const id = `${lessonId}-q-${index + 1}`;
        return {
          id,
          prompt: `Lesson ${lessonNumber}, question ${index + 1}: which statement best reflects ${input.topic}?`,
          multiple: false,
          options: ["A", "B", "C", "D"].map((label) => ({
            id: `${id}-${label.toLowerCase()}`,
            text: `Option ${label} about ${input.topic}`,
          })),
          correctOptionIds: [`${id}-a`],
          explanation:
            "Option A is the best answer because it applies the lesson's key idea. This is a mock question generated without a live model.",
        };
      },
    );
    return {
      id: lessonId,
      title: `Lesson ${lessonNumber}: ${input.topic}`,
      blocks: [
        {
          id: `${lessonId}-text`,
          type: "text" as const,
          body: pageMarkdown(input.topic, lessonNumber),
        },
        {
          id: `${lessonId}-quiz-block`,
          type: "activity" as const,
          activity: {
            id: `${lessonId}-quiz`,
            type: "quiz" as const,
            title: "Check your understanding",
            prompt: "Answer all five questions.",
            rubric: "One point per correct answer.",
            questions,
          },
        },
      ],
    };
  });
  return courseDraftSchema.parse({
    title: `${input.topic}: a short course`,
    description: `A mock micro-course for ${input.audience} at ${input.difficulty} level. It exercises the full workflow without calling a live AI model.`,
    subject: input.subject,
    audience: input.audience,
    goals: (() => {
      const goals = input.goals
        .split(/[\n；;]/)
        .map((goal) => goal.trim())
        .filter(Boolean)
        .slice(0, 8);
      return goals.length ? goals : [`Understand the basics of ${input.topic}`];
    })(),
    lessons,
  });
}
