import { courseDraftSchema, type CourseDraft } from "@/shared/contracts";

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidates = [fenced?.[1]?.trim() ?? trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    "The model did not return valid JSON. Regenerate the course or try again.",
  );
}

export function parseGeneratedCourse(raw: string): CourseDraft {
  const parsed = extractJson(raw);
  const result = courseDraftSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue.path.length ? ` at ${issue.path.join(".")}` : "";
    throw new Error(
      `The generated course has an invalid structure${location}: ${issue.message}.`,
    );
  }
  return result.data;
}
