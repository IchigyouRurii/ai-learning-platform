import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COURSE_LEVELS,
  courseDraftSchema,
  editableCourseLevels,
  generationInputSchema,
  lessonsAtLevel,
  toSafeCourse,
} from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";
import { generateCourse } from "@/modules/course-generation";

afterEach(() => vi.unstubAllEnvs());
describe("difficulty materials", () => {
  it("projects legacy published content into each level without mutating its IDs or snapshot", () => {
    const course = createSeedState().courses[0];
    const original = structuredClone(course);
    for (const level of COURSE_LEVELS)
      expect(lessonsAtLevel(course.lessons, level)).toEqual(course.lessons);
    expect(course).toEqual(original);
  });
  it("copies legacy authoring materials into independently editable sets with globally unique identifiers", () => {
    const course = createSeedState().courses[0];
    const content = editableCourseLevels(course);
    expect(courseDraftSchema.safeParse(content).success).toBe(true);
    for (const level of COURSE_LEVELS)
      expect(lessonsAtLevel(content.lessons, level)).toHaveLength(
        course.lessons.length,
      );
    const beginner = lessonsAtLevel(content.lessons, "beginner");
    const expert = lessonsAtLevel(content.lessons, "expert");
    expert[0].title = "Changed";
    expect(beginner[0].title).not.toBe("Changed");
    expect(course.lessons[0].title).not.toBe("Changed");
    expect(beginner[0].id).toBe(course.lessons[0].id);
    const ids = content.lessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(editableCourseLevels(content)).toEqual(content);
    expect(JSON.stringify(toSafeCourse(content))).not.toContain(
      "correctOptionIds",
    );
  });
  it("validates controlled subjects while retaining compatibility with historical generation inputs", () => {
    const input = {
      topic: "Algebra",
      audience: "Learners",
      goals: "Solve equations",
    };
    expect(generationInputSchema.parse(input).subject).toBe("Computer Science");
    expect(
      generationInputSchema.safeParse({ ...input, subject: "Uncontrolled" })
        .success,
    ).toBe(false);
  });
  it("assigns server-selected levels and collision-free IDs even when the model reuses IDs", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const drafts = [];
    for (const difficulty of COURSE_LEVELS) {
      const draft = await generateCourse({
        topic: "Algebra",
        subject: "Mathematics",
        description: "Solve equations",
        audience: "Learners",
        goals: "Solve equations",
        materials: "",
        difficulty,
      });
      expect(draft.subject).toBe("Mathematics");
      expect(draft.description).toBe("Solve equations");
      expect(
        draft.lessons.every((lesson) => lesson.difficulty === difficulty),
      ).toBe(true);
      drafts.push(draft);
    }
    const combined = {
      ...drafts[0],
      lessons: drafts.flatMap((draft) => draft.lessons),
    };
    expect(courseDraftSchema.safeParse(combined).success).toBe(true);
    expect(lessonsAtLevel(combined.lessons, "expert")).toHaveLength(3);
    expect(JSON.stringify(toSafeCourse(combined))).not.toContain(
      "correctOptionIds",
    );
  });
  it("rejects unknown levels and does not substitute another generated level", () => {
    const course = editableCourseLevels(createSeedState().courses[0]);
    expect(
      courseDraftSchema.safeParse({
        ...course,
        lessons: [{ ...course.lessons[0], difficulty: "impossible" }],
      }).success,
    ).toBe(false);
    expect(
      lessonsAtLevel(
        [{ ...course.lessons[0], difficulty: "beginner" }],
        "expert",
      ),
    ).toEqual([]);
  });
});

it("rejects more than twelve lessons in one difficulty even within the total course limit", () => {
  const course = createSeedState().courses[0];
  const lessons = Array.from({ length: 13 }, (_, index) => ({
    id: `lesson-${index}`,
    difficulty: "expert",
    title: "Lesson",
    blocks: [{ id: `text-${index}`, type: "text", body: "Explanation" }],
  }));
  expect(courseDraftSchema.safeParse({ ...course, lessons }).success).toBe(
    false,
  );
});
