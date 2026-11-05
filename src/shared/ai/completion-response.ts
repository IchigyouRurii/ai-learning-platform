/** Transport envelope only. Business JSON validation remains in each module. */
export type CompletionEnvelope = {
  error?: { code?: number };
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null; refusal?: string | null };
    delta?: { content?: string | null; refusal?: string | null };
  }[];
};
export function decodeCompletionResponse(
  text: string,
  contentType: string,
): CompletionEnvelope {
  const source = text.replace(/^\uFEFF/, "").trim();
  if (
    !contentType.toLowerCase().includes("text/event-stream") &&
    !source.startsWith(":") &&
    !source.startsWith("data:")
  ) {
    if (source.startsWith("<"))
      throw new Error(
        "The AI gateway returned a web error page instead of a model response. Please retry later.",
      );
    try {
      return JSON.parse(source) as CompletionEnvelope;
    } catch {
      throw new Error(
        "The AI service returned an incomplete or unreadable response. Please retry later.",
      );
    }
  }
  let content = "";
  let finish: string | null = null;
  let refusal: string | null = null;
  let done = false;
  for (const event of source.replace(/\r\n/g, "\n").split(/\n\n+/)) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue; // Ignore SSE processing/keep-alive comments.
    if (data === "[DONE]") {
      done = true;
      break;
    }
    let frame: CompletionEnvelope;
    try {
      frame = JSON.parse(data) as CompletionEnvelope;
    } catch {
      throw new Error(
        "The AI response stream was interrupted. Please retry later.",
      );
    }
    if (!frame || typeof frame !== "object")
      throw new Error("The AI service returned an invalid stream event.");
    if (frame.error) return { error: frame.error };
    const choice = frame.choices?.[0];
    if (typeof choice?.delta?.content === "string")
      content += choice.delta.content;
    if (typeof choice?.message?.content === "string")
      content += choice.message.content;
    if (choice?.delta?.refusal || choice?.message?.refusal) refusal = "refused";
    if (choice?.finish_reason) finish = choice.finish_reason;
  }
  if (!finish || !done)
    throw new Error(
      "The AI response stream ended before completion. Please retry later.",
    );
  return {
    choices: [{ finish_reason: finish, message: { content, refusal } }],
  };
}
