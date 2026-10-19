import { courseDraftSchema, type CourseDraft } from "@/shared/contracts";

export function parseGeneratedCourse(raw: string): CourseDraft {
  const trimmed = raw.trim();
  // Some instruction-following free models wrap an otherwise valid JSON object
  // in a single fenced block. Accept that wrapper, then validate the same schema.
  const fenced = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new Error(
      "The generated course is not valid JSON. Regenerate or choose another model.",
    );
  }
  const result = courseDraftSchema.safeParse(parsed);
  if (!result.success)
    throw new Error(
      "The draft has missing or invalid fields. Please regenerate.",
    );
  return result.data;
}
