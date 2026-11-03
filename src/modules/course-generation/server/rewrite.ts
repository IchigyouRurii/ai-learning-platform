import "server-only";
import { complete, getAIProvider } from "@/shared/ai/client";
import { rewriteSystemPrompt, rewriteUserMessage } from "../prompts/rewrite";

export type RewriteKind = "text" | "activity";

export type RewriteInput = {
  courseTitle: string;
  lessonTitle: string;
  body: string;
  instruction: string;
  kind: RewriteKind;
};

export function countMarkdownPages(body: string) {
  return body
    .split(/\n\s*---\s*\n/)
    .map((page) => page.trim())
    .filter(Boolean).length;
}

function clean(text: string) {
  return text
    .trim()
    .replace(/^```(?:markdown|md|json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function pageText(text: string) {
  return text
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parsePages(raw: string): string[] | null {
  const cleaned = clean(raw);
  const candidates = [cleaned];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(cleaned.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const values = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "pages" in parsed
          ? (parsed as { pages: unknown }).pages
          : null;
      if (
        Array.isArray(values) &&
        values.every((item) => typeof item === "string")
      )
        return values as string[];
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function chunkText(text: string, count: number): string[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => pageText(block))
    .filter(Boolean);
  const pieces = blocks.flatMap((block) => {
    if (block.length <= 420) return [block];
    const sentences = block.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > 320) {
        chunks.push(current.trim());
        current = sentence;
      } else current += `${current ? " " : ""}${sentence}`;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  });
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const target = Math.max(1, Math.ceil(total / count));
  const pages: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const piece of pieces) {
    if (
      current.length &&
      length + piece.length > target &&
      pages.length < count - 1
    ) {
      pages.push(current.join("\n\n"));
      current = [];
      length = 0;
    }
    current.push(piece);
    length += piece.length;
  }
  if (current.length) pages.push(current.join("\n\n"));
  while (pages.length < count)
    pages.push("## Summary\n\nReview the key idea and try one short practice task.");
  return pages.slice(0, count);
}

function normalizePages(pages: string[], count: number) {
  const kept = pages.map(pageText).filter(Boolean);
  if (kept.length === count) return kept;
  if (kept.length > count) {
    const perPage = kept.length / count;
    return Array.from({ length: count }, (_, index) => {
      const start = Math.floor(index * perPage);
      const end = Math.max(start + 1, Math.floor((index + 1) * perPage));
      return kept.slice(start, end).join("\n\n");
    });
  }
  return chunkText(kept.join("\n\n"), count);
}

export async function rewriteText(input: RewriteInput): Promise<string> {
  const pageCount = input.kind === "text" ? countMarkdownPages(input.body) : 0;

  if (getAIProvider() === "mock") {
    if (input.kind !== "text")
      return `${input.body}\n\n[Demo rewrite — no live model call. Requested change: ${input.instruction}]`;
    const pages = input.body.split(/\n\s*---\s*\n/);
    if (pages[0])
      pages[0] = `${pages[0]}\n\n**Demo rewrite:** ${input.instruction}`;
    return pages.join("\n\n---\n\n");
  }

  if (input.kind === "activity") {
    const text = clean(
      await complete(
        [
          { role: "system", content: rewriteSystemPrompt("activity") },
          { role: "user", content: rewriteUserMessage(input) },
        ],
        false,
        { maxTokens: 1600, temperature: 0.4, timeoutMs: 120000 },
      ),
    );
    if (!text) throw new Error("The model returned no replacement text.");
    return text;
  }

  const messages = [
    {
      role: "system" as const,
      content: rewriteSystemPrompt("text", pageCount),
    },
    {
      role: "user" as const,
      content: rewriteUserMessage({ ...input, pageCount }),
    },
  ];
  const options = {
    maxTokens: 5000,
    temperature: 0.4,
    timeoutMs: 180000,
  };
  const first = clean(await complete(messages, true, options));
  const parsed = parsePages(first);
  if (!parsed || parsed.length !== pageCount) {
    // One repair attempt; then fall back to normalising whatever text we got.
    const repaired = clean(
      await complete(
        [
          ...messages,
          {
            role: "user",
            content: `Your previous response did not contain exactly ${pageCount} page strings. Return only {"pages":[...]} with exactly ${pageCount} strings. Do not merge or omit pages.`,
          },
        ],
        true,
        options,
      ),
    );
    const repairedPages = parsePages(repaired);
    if (repairedPages && repairedPages.length === pageCount)
      return normalizePages(repairedPages, pageCount).join("\n\n---\n\n");
    if (countMarkdownPages(repaired) === pageCount)
      return repaired;
    return normalizePages(
      repairedPages ?? parsed ?? chunkText(repaired, pageCount),
      pageCount,
    ).join("\n\n---\n\n");
  }
  return normalizePages(parsed, pageCount).join("\n\n---\n\n");
}
