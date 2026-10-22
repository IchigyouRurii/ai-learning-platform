import "server-only";
import { complete, getAIProvider } from "@/shared/ai/client";
import {
  REWRITE_SYSTEM_PROMPT,
  rewriteUserMessage,
} from "../prompts/rewrite";

export type RewriteInput = {
  courseTitle: string;
  lessonTitle: string;
  body: string;
  instruction: string;
};

export async function rewriteText(input: RewriteInput): Promise<string> {
  if (getAIProvider() === "mock")
    return `${input.body}\n\n[Demo rewrite — no live model call. Requested change: ${input.instruction}]`;
  const text = await complete(
    [
      { role: "system", content: REWRITE_SYSTEM_PROMPT },
      { role: "user", content: rewriteUserMessage(input) },
    ],
    false,
    { maxTokens: 1600, temperature: 0.5 },
  );
  const cleaned = text.trim().replace(/^```(?:\w+)?\s*|\s*```$/g, "").trim();
  if (!cleaned) throw new Error("The model returned no replacement text.");
  return cleaned;
}
