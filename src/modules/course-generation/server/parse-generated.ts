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
    throw new Error("AI 返回的课程不是完整 JSON，请重新生成或更换模型。");
  }
  const result = courseDraftSchema.safeParse(parsed);
  if (!result.success)
    throw new Error("AI 草稿缺少必要字段或内容格式不正确，请重新生成。");
  return result.data;
}
