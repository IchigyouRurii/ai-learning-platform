import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { complete } from "@/shared/ai/client";
import { createSeedState } from "@/shared/database/seed";
import { generateCourse } from "@/modules/teacher/course-builder/server/generate";
import { parseGeneratedCourse } from "@/modules/teacher/course-builder/server/parse-generated";

const fetchMock = vi.fn();
const messages = [{ role: "user" as const, content: "给出一个学习提示" }];
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AI_PROVIDER", "openrouter");
  vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1");
  vi.stubEnv("AI_MODEL", "example/test-model:free");
  vi.stubEnv("AI_API_KEY", "test-only-placeholder");
  vi.stubEnv("AI_FREE_ONLY", "true");
  vi.stubEnv("AI_JSON_MODE", "prompt");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function response(content: string, finishReason = "stop") {
  return Response.json({
    choices: [{ finish_reason: finishReason, message: { content } }],
  });
}

function validCourse() {
  const base = createSeedState().courses[0];
  const lessons = [1, 2, 3].map((lessonNumber) => {
    const questions = Array.from({ length: 5 }, (_, index) => {
      const id = `q-${lessonNumber}-${index}`;
      const options = ["A", "B", "C", "D"].map((label) => ({
        id: `${id}-${label.toLowerCase()}`,
        text: `Option ${label}`,
      }));
      return {
        id,
        prompt: `Question ${index + 1}`,
        multiple: false,
        options,
        correctOptionIds: [options[0].id],
        explanation: "Option A is correct.",
      };
    });
    return {
      id: `lesson-${lessonNumber}`,
      title: `Lesson ${lessonNumber}`,
      blocks: [
        {
          id: `text-${lessonNumber}`,
          type: "text" as const,
          body: Array.from(
            { length: 10 },
            (_, page) => `## Page ${page + 1}\n\n- Short point.`,
          ).join("\n\n---\n\n"),
        },
        {
          id: `quiz-block-${lessonNumber}`,
          type: "activity" as const,
          activity: {
            id: `quiz-${lessonNumber}`,
            type: "quiz" as const,
            title: "Check your understanding",
            prompt: "Answer all five questions.",
            rubric: "One point per correct answer.",
            questions,
          },
        },
      ],
    };
  });
  return { ...base, title: "Requirements course", lessons };
}

describe("OpenRouter transport and course integration", () => {
  it("sends a single authenticated request without unsupported JSON parameters in prompt mode", async () => {
    fetchMock.mockResolvedValue(response("学习提示"));
    expect(await complete(messages, true)).toBe("学习提示");
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-only-placeholder",
    });
    expect(JSON.parse(String(options.body))).toMatchObject({
      model: "example/test-model:free",
      messages,
    });
    expect(JSON.parse(String(options.body))).not.toHaveProperty(
      "response_format",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects paid model IDs before any request while the free-only setting is enabled", async () => {
    vi.stubEnv("AI_MODEL", "example/paid-model");
    await expect(complete(messages)).rejects.toThrow("free routes");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("prevents OpenRouter credentials being sent to an incorrectly configured provider address", async () => {
    vi.stubEnv("AI_BASE_URL", "https://api.openai.com/v1");
    await expect(complete(messages)).rejects.toThrow("OpenRouter requires");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires configuration instead of silently returning mock results", async () => {
    vi.stubEnv("AI_API_KEY", "");
    await expect(complete(messages)).rejects.toThrow("AI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("supports explicitly enabled JSON object output and preserves compatible-provider behavior", async () => {
    vi.stubEnv("AI_JSON_MODE", "json_object");
    fetchMock.mockImplementation(async () => response("{}"));
    await complete(messages, true);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
      response_format: { type: "json_object" },
      provider: { require_parameters: true },
    });
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_BASE_URL", "https://api.openai.com/v1");
    await complete(messages, true);
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1].body)),
    ).not.toHaveProperty("provider");
  });
  it("explains throttling without retrying or falling back to a paid model", async () => {
    fetchMock.mockResolvedValue(
      new Response("provider-internal-details", { status: 429 }),
    );
    await expect(complete(messages)).rejects.toThrow("rate limit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("handles an error inside a successful HTTP response", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        error: { code: 503, message: "provider-internal-details" },
      }),
    );
    await expect(complete(messages)).rejects.toThrow("temporarily unavailable");
  });
  it("rejects truncated or empty model output", async () => {
    fetchMock
      .mockResolvedValueOnce(response("partial", "length"))
      .mockResolvedValueOnce(response(""));
    await expect(complete(messages)).rejects.toThrow("truncated");
    await expect(complete(messages)).rejects.toThrow("usable text");
  });
  it("accepts a complete fenced JSON course but still validates the course schema", async () => {
    const course = validCourse();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        response("```json\n" + JSON.stringify(course) + "\n```"),
      ),
    );
    const result = await generateCourse({
      topic: "需求描述",
      audience: "初学者",
      goals: "写出清晰的需求",
      difficulty: "beginner",
      materials: "",
    });
    expect(result.title).toBe(course.title);
    expect(() => parseGeneratedCourse('{"title":"incomplete"}')).toThrow(
      "invalid structure",
    );
    expect(() =>
      parseGeneratedCourse('课程如下：{"title":"incomplete"}'),
    ).toThrow("invalid structure");
  });
});
