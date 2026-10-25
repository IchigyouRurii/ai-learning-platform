import { describe, expect, it } from "vitest";
import type { DemoState, GenerationRecord, LearningPathRecord } from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";
import { createLocalPlatformRepository } from "@/shared/database/local-platform-repository";

function repository() {
  let state: DemoState = createSeedState();
  return createLocalPlatformRepository({
    read: async () => structuredClone(state),
    mutate: async <T>(operation: (draft: DemoState) => T) => {
      const draft = structuredClone(state);
      const value = operation(draft);
      state = draft;
      return value;
    },
  });
}

const record = (
  id: string,
  kind: GenerationRecord["kind"],
  createdAt: string,
  courseId: string | null = null,
): GenerationRecord => ({
  id,
  ownerId: "demo-student",
  kind,
  courseId,
  input: { topic: id },
  result: { title: id },
  createdAt,
});

const path = (
  id: string,
  title: string,
  createdAt: string,
): LearningPathRecord => ({
  id,
  ownerId: "demo-student",
  title,
  steps: [
    {
      courseId: "ai-coding",
      courseVersion: 1,
      order: 0,
      targetMinutes: 30,
      reason: "Start here.",
    },
  ],
  createdAt,
  updatedAt: createdAt,
});

describe("local AI history", () => {
  it("lists generation records newest first and filters by kind", async () => {
    const repo = repository();
    await repo.insertGenerationRecord(record("old", "course", "2026-10-20T00:00:00.000Z"));
    await repo.insertGenerationRecord(record("new", "course", "2026-10-21T00:00:00.000Z"));
    await repo.insertGenerationRecord(record("rewrite", "rewrite", "2026-10-22T00:00:00.000Z", "ai-coding"));
    const courseRecords = await repo.listGenerationRecords("demo-student", {
      kind: "course",
    });
    expect(courseRecords.map((item) => item.id)).toEqual(["new", "old"]);
    expect(
      (await repo.listGenerationRecords("demo-student", {
        kind: "rewrite",
        courseId: "ai-coding",
      })).map((item) => item.id),
    ).toEqual(["rewrite"]);
    expect(
      (await repo.listGenerationRecords("demo-other")).length,
    ).toBe(0);
  });

  it("keeps every saved path while returning the newest one", async () => {
    const repo = repository();
    await repo.saveLearningPath(path("path-1", "First", "2026-10-20T00:00:00.000Z"));
    await repo.saveLearningPath(path("path-2", "Second", "2026-10-21T00:00:00.000Z"));
    expect((await repo.listLearningPaths("demo-student")).map((p) => p.title)).toEqual([
      "Second",
      "First",
    ]);
    expect((await repo.getLearningPath("demo-student"))?.title).toBe("Second");
  });
});
