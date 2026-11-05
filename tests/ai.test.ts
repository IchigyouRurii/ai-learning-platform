import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLesson } from "@/modules/course-generation/server/lesson";
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
  it("requests and assembles an OpenRouter stream for long generation calls", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        ': OPENROUTER PROCESSING\n\ndata: {"choices":[{"delta":{"content":"Complete text"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    expect(await complete(messages, false, { stream: true })).toBe(
      "Complete text",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects truncated or empty model output", async () => {
    fetchMock
      .mockResolvedValueOnce(response("partial", "length"))
      .mockResolvedValueOnce(response(""));
    await expect(complete(messages)).rejects.toThrow("truncated");
    await expect(complete(messages)).rejects.toThrow("usable text");
  });
  it.each([1, 4, 10])(
    "accepts an AI-selected lesson length of %i pages",
    async (pages) => {
      const lesson = validCourse().lessons[0];
      lesson.blocks[0] = {
        id: "text",
        type: "text",
        body: Array.from(
          { length: pages },
          (_, i) => `## Page ${i + 1}\n\nFocused content.`,
        ).join("\n\n---\n\n"),
      };
      fetchMock.mockResolvedValueOnce(response(JSON.stringify(lesson)));
      const result = await generateLesson({
        courseTitle: "Requirements",
        difficulty: "expert",
        existingLessons: [],
        instruction: "Teach requirements",
        materials: "",
      });
      expect(result.blocks[0]).toMatchObject({ body: lesson.blocks[0].body });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each([1, 3, 5, 6])(
    "validates adaptive quiz counts (%i questions)",
    async (count) => {
      const lesson = validCourse().lessons[0];
      const quiz = lesson.blocks[1];
      if (quiz.type !== "activity") throw new Error("Missing fixture quiz");
      quiz.activity.questions = Array.from({ length: count }, (_, i) => {
        const question = structuredClone(quiz.activity.questions[0]);
        return { ...question, id: `question-${i}` };
      });
      fetchMock.mockResolvedValueOnce(response(JSON.stringify(lesson)));
      const generating = generateLesson({
        courseTitle: "Requirements",
        difficulty: "expert",
        existingLessons: [],
        instruction: "Teach requirements",
        materials: "",
      });
      if (count > 5) await expect(generating).rejects.toThrow("1 to 5");
      else {
        const result = await generating;
        expect(
          result.blocks.find((block) => block.type === "activity"),
        ).toMatchObject({ activity: { questions: expect.any(Array) } });
      }
    },
  );
  it("retries a truncated chapter once without attachments or a model change", async () => {
    const lesson = validCourse().lessons[0];
    fetchMock
      .mockResolvedValueOnce(response("partial", "length"))
      .mockResolvedValueOnce(response(JSON.stringify(lesson)));
    await generateLesson({
      courseTitle: "Requirements",
      difficulty: "expert",
      existingLessons: [],
      instruction: "Teach requirements",
      materials: "",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map(([, options]) =>
      JSON.parse(String(options.body)),
    );
    expect(requests[1].model).toBe(requests[0].model);
    expect(requests[1].max_tokens).toBe(12000);
    expect(requests[1].messages.at(-1).content).toContain("1-3 focused pages");
  });
  it("does not retry a chapter indefinitely or retry quota errors", async () => {
    const input = {
      courseTitle: "Requirements",
      difficulty: "expert" as const,
      existingLessons: [],
      instruction: "Teach requirements",
      materials: "",
    };
    fetchMock.mockImplementation(() =>
      Promise.resolve(response("partial", "length")),
    );
    await expect(generateLesson(input)).rejects.toThrow("truncated");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockReset().mockResolvedValue(new Response("", { status: 429 }));
    await expect(generateLesson(input)).rejects.toThrow("rate limit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("starts all three chapters before waiting and preserves outline order", async () => {
    const course = validCourse();
    fetchMock.mockResolvedValueOnce(
      response(
        JSON.stringify({
          title: course.title,
          description: "Learn requirements",
          goals: course.goals,
          lessons: course.lessons.map((lesson) => ({
            title: lesson.title,
            objective: "Understand requirements",
          })),
        }),
      ),
    );
    const pending: Array<(response: Response) => void> = [];
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          pending.push(resolve);
        }),
    );
    const generating = generateCourse({
      topic: "Requirements",
      audience: "Beginners",
      goals: "Write requirements",
      difficulty: "beginner",
      materials: "",
    });
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    for (let index = 2; index >= 0; index--)
      pending[index](response(JSON.stringify(course.lessons[index])));
    const result = await generating;
    expect(result.lessons.map((lesson) => lesson.title)).toEqual(
      course.lessons.map((lesson) => lesson.title),
    );
    for (const [, options] of fetchMock.mock.calls.slice(1)) {
      const body = JSON.parse(String(options.body));
      const context = JSON.parse(body.messages[1].content);
      expect(context.existingLessons).toHaveLength(2);
      expect(context.materials).toBe("");
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("rejects a failed parallel chapter without publishing a partial course", async () => {
    const course = validCourse();
    fetchMock
      .mockResolvedValueOnce(
        response(
          JSON.stringify({
            title: course.title,
            description: "Learn requirements",
            goals: course.goals,
            lessons: course.lessons.map((lesson) => ({
              title: lesson.title,
              objective: "Learn",
            })),
          }),
        ),
      )
      .mockResolvedValueOnce(response(JSON.stringify(course.lessons[0])))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(response(JSON.stringify(course.lessons[2])));
    await expect(
      generateCourse({
        topic: "Requirements",
        audience: "Beginners",
        goals: "Write requirements",
        difficulty: "beginner",
        materials: "",
      }),
    ).rejects.toThrow("Lesson 2 of 3 could not be generated: Model rate limit");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("accepts a complete fenced JSON course but still validates the course schema", async () => {
    const course = validCourse();
    fetchMock.mockResolvedValueOnce(
      response(
        JSON.stringify({
          title: course.title,
          description: "Learn requirements",
          goals: course.goals,
          lessons: course.lessons.map((lesson) => ({
            title: lesson.title,
            objective: "Understand requirements",
          })),
        }),
      ),
    );
    // Independent model calls may reuse IDs; assembly must namespace them per chapter.
    for (const lesson of course.lessons)
      fetchMock.mockResolvedValueOnce(
        response(
          "```json\n" +
            JSON.stringify({ ...course.lessons[0], title: lesson.title }) +
            "\n```",
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
    expect(result.lessons).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(() => parseGeneratedCourse('{"title":"incomplete"}')).toThrow(
      "invalid structure",
    );
    expect(() =>
      parseGeneratedCourse('课程如下：{"title":"incomplete"}'),
    ).toThrow("invalid structure");
  });
});
