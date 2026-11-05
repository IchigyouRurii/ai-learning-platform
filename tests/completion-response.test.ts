import { expect, it } from "vitest";
import { decodeCompletionResponse } from "@/shared/ai/completion-response";
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
it("accepts JSON envelopes and identifies gateway HTML separately", () => {
  expect(
    decodeCompletionResponse('{"choices":[]}', "application/json"),
  ).toEqual({ choices: [] });
  expect(() =>
    decodeCompletionResponse("<html>Gateway error</html>", "text/html"),
  ).toThrow("gateway");
  expect(() =>
    decodeCompletionResponse('{"choices":', "application/json"),
  ).toThrow("incomplete");
});
it("assembles streamed content while ignoring reasoning and processing comments", () => {
  const stream =
    ": OPENROUTER PROCESSING\n\n" +
    frame({ choices: [{ delta: { reasoning: "private reasoning" } }] }) +
    frame({ choices: [{ delta: { content: '{"title":' } }] }) +
    frame({
      choices: [{ delta: { content: '"Course"}' }, finish_reason: "stop" }],
    }) +
    "data: [DONE]\n\n";
  const result = decodeCompletionResponse(stream, "text/event-stream");
  expect(result.choices?.[0].message?.content).toBe('{"title":"Course"}');
  expect(result.choices?.[0].finish_reason).toBe("stop");
});
it("does not accept a partial stream or hide a provider error", () => {
  expect(() =>
    decodeCompletionResponse(
      frame({ choices: [{ delta: { content: "partial" } }] }),
      "text/event-stream",
    ),
  ).toThrow("before completion");
  expect(
    decodeCompletionResponse(
      frame({ error: { code: 503, message: "private upstream details" } }),
      "text/event-stream",
    ).error?.code,
  ).toBe(503);
  const length = decodeCompletionResponse(
    frame({
      choices: [{ delta: { content: "partial" }, finish_reason: "length" }],
    }) + "data: [DONE]",
    "text/event-stream",
  );
  expect(length.choices?.[0].finish_reason).toBe("length");
});
