/** Extractive condensation: retain original evidence, favor goal-relevant passages, never invent a summary. */
export const REFERENCE_DIGEST_CHARACTERS = 8000;
const STOP_WORDS = new Set(
  "the and for with from that this into your will able course learning students skills development software introduction fundamentals about through their have each what when how".split(
    " ",
  ),
);
function terms(text: string): string[] {
  return [
    ...new Set(
      (
        text.toLowerCase().match(/[a-z][a-z0-9-]{2,}|[\u4e00-\u9fff]{2,}/g) ??
        []
      ).filter((word) => !STOP_WORDS.has(word)),
    ),
  ];
}
export function compactReferenceMaterials(
  text: string,
  topic: string,
  goals: string,
): string {
  const source = text.trim();
  if (source.length <= REFERENCE_DIGEST_CHARACTERS) return source;
  const keywords = terms(`${topic} ${goals}`);
  const passages: { start: number; body: string; score: number }[] = [];
  for (let start = 0; start < source.length;) {
    let end = Math.min(start + 1000, source.length);
    if (end < source.length) {
      const boundary = Math.max(
        source.lastIndexOf("\n", end),
        source.lastIndexOf(" ", end),
      );
      if (boundary > start + 500) end = boundary;
    }
    const body = source.slice(start, end).trim();
    const lower = body.toLowerCase();
    const score = keywords.reduce(
      (sum, word) => sum + (lower.includes(word) ? 1 : 0),
      0,
    );
    passages.push({ start, body, score });
    start = end;
  }
  // Spread equally relevant excerpts across the document instead of taking only its beginning.
  const selected: typeof passages = [];
  const ranked = [...passages].sort(
    (a, b) => b.score - a.score || a.start - b.start,
  );
  const prefix =
    "Selected reference excerpts relevant to the course goals (not the complete document):\n\n";
  let remaining = REFERENCE_DIGEST_CHARACTERS - prefix.length;
  const used = new Set<number>();
  while (ranked.length && remaining > 80) {
    const bestScore = ranked[0].score;
    const best = ranked.filter(
      (passage) => passage.score === bestScore && !used.has(passage.start),
    );
    if (!best.length) break;
    const passage = selected.length
      ? best.reduce((chosen, item) => {
          const distance = (candidate: typeof item) =>
            Math.min(
              ...selected.map((entry) =>
                Math.abs(entry.start - candidate.start),
              ),
            );
          return distance(item) > distance(chosen) ? item : chosen;
        })
      : best[0];
    used.add(passage.start);
    ranked.splice(ranked.indexOf(passage), 1);
    const overhead = "\n\n[Excerpt]\n".length;
    const body = passage.body.slice(0, Math.max(0, remaining - overhead));
    if (body) {
      selected.push({ ...passage, body });
      remaining -= body.length + overhead;
    }
  }
  return (
    prefix +
    selected
      .sort((a, b) => a.start - b.start)
      .map((passage) => `[Excerpt]\n${passage.body}`)
      .join("\n\n")
  );
}
