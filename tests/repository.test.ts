import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDemoRepository } from "@/shared/database/demo-repository";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "minicourse-test-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("local repository", () => {
  it("serializes simultaneous writes and survives a new repository instance", async () => {
    const file = join(directory, "state.json");
    const repository = createDemoRepository(file);
    await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        repository.mutate((state) => {
          state.enrollments.push({
            courseId: "ai-coding",
            studentId: `student-${index}`,
            joinedAt: "2026-10-16",
          });
        }),
      ),
    );
    expect((await createDemoRepository(file).read()).enrollments).toHaveLength(
      16,
    );
  });
  it("a failed transaction does not write partial data or block later writes", async () => {
    const repository = createDemoRepository(join(directory, "state.json"));
    await expect(
      repository.mutate((state) => {
        state.courses = [];
        throw new Error("Abort");
      }),
    ).rejects.toThrow("Abort");
    await repository.mutate((state) => {
      state.feedback = [];
    });
    expect((await repository.read()).courses).toHaveLength(3);
  });
});
