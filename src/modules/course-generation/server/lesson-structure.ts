export const PAGES_PER_LESSON = 10;
export const QUESTIONS_PER_LESSON = 5;
export function splitMarkdownPages(body: string) {
  return body
    .split(/\n\s*---\s*\n/)
    .map((page) => page.trim())
    .filter(Boolean);
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
