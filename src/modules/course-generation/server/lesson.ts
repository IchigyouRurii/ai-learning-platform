import "server-only";
import { randomUUID } from "node:crypto";
import {
  lessonSchema,
  type CourseLevel,
  type Lesson,
} from "@/shared/contracts";
import { complete, getAIProvider } from "@/shared/ai/client";
import { lessonSystemPrompt, lessonUserMessage } from "../prompts/lesson";
import { pageMarkdown, splitMarkdownPages } from "./generate";

export type LessonInput = {
  courseTitle: string;
  difficulty: CourseLevel;
  existingLessons: string[];
  instruction: string;
  materials: string;
};

const PAGES = 10;
const QUESTIONS = 5;

function parseLesson(raw: string): Lesson {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  const candidates = [fenced?.[1]?.trim() ?? trimmed];
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const parsed = lessonSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    "The generated lesson is not valid JSON with the expected structure.",
  );
}

function assertLesson(lesson: Lesson) {
  const text = lesson.blocks.find((block) => block.type === "text");
  const quiz = lesson.blocks.find(
    (block) => block.type === "activity" && block.activity.type === "quiz",
  );
  if (!text)
    throw new Error("The generated lesson needs a text block with pages.");
  if (splitMarkdownPages(text.body).length !== PAGES)
    throw new Error(
      `The generated lesson must contain exactly ${PAGES} Markdown pages separated by ---.`,
    );
  if (!quiz || quiz.type !== "activity")
    throw new Error("The generated lesson needs exactly one quiz activity.");
  if ((quiz.activity.questions?.length ?? 0) !== QUESTIONS)
    throw new Error(
      `The generated lesson quiz must contain exactly ${QUESTIONS} questions.`,
    );
  return lesson;
}

function mockLesson(input: LessonInput): Lesson {
  const suffix = randomUUID().slice(0, 8);
  const questions = Array.from({ length: QUESTIONS }, (_, index) => {
    const id = `new-q-${suffix}-${index + 1}`;
    return {
      id,
      prompt: `Question ${index + 1} about ${input.courseTitle}?`,
      multiple: false,
      options: ["A", "B", "C", "D"].map((label) => ({
        id: `${id}-${label.toLowerCase()}`,
        text: `Option ${label}`,
      })),
      correctOptionIds: [`${id}-a`],
      explanation:
        "Option A is correct. This is mock content without a live model.",
    };
  });
  return lessonSchema.parse({
    difficulty: input.difficulty,
    id: `new-lesson-${suffix}`,
    title: `New lesson: ${input.instruction.slice(0, 80)}`,
    blocks: [
      {
        id: `new-text-${suffix}`,
        type: "text",
        body: pageMarkdown(input.courseTitle, input.existingLessons.length + 1),
      },
      {
        id: `new-quiz-block-${suffix}`,
        type: "activity",
        activity: {
          id: `new-quiz-${suffix}`,
          type: "quiz",
          title: "Check your understanding",
          prompt: "Answer all five questions.",
          rubric: "One point per correct answer.",
          questions,
        },
      },
    ],
  });
}

export async function generateLesson(input: LessonInput): Promise<Lesson> {
  if (getAIProvider() === "mock") return mockLesson(input);
  const text = await complete(
    [
      { role: "system", content: lessonSystemPrompt(input.difficulty) },
      { role: "user", content: lessonUserMessage(input) },
    ],
    true,
    { maxTokens: 4000, temperature: 0.5, timeoutMs: 180000 },
  );
  return assertLesson(parseLesson(text));
}
