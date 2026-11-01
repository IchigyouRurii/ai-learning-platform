import { beforeEach, expect, it } from "vitest";
import type { DemoState, User } from "@/shared/contracts";
import { createSeedState } from "@/shared/database/seed";
import { createLocalPlatformRepository } from "@/shared/database/local-platform-repository";

let state: DemoState;
const teacher: User = { id: "demo-teacher", role: "teacher", name: "Author" };
const reader: User = { id: "another-teacher", role: "teacher", name: "Reader" };
const repository = createLocalPlatformRepository({
  read: async () => structuredClone(state),
  mutate: async (operation) => {
    const draft = structuredClone(state);
    const result = operation(draft);
    state = draft;
    return result;
  },
});
beforeEach(() => {
  state = createSeedState();
  state.courses = [{ ...state.courses[0], status: "draft" }];
});
it("keeps drafts private, exposes published snapshots to other teachers, and excludes private or withdrawn courses", async () => {
  const id = state.courses[0].id;
  expect(await repository.listCatalog(reader)).toEqual([]);
  expect(await repository.findPublishedCourse(reader, id)).toBeNull();
  await repository.publishCourse(id, teacher.id);
  const publishedTitle = state.courses[0].title;
  state.courses[0].title = "Private draft title";
  expect((await repository.listCatalog(reader))[0].title).toBe(publishedTitle);
  const published = await repository.findPublishedCourse(reader, id);
  expect(published?.content.title).toBe(publishedTitle);
  expect(JSON.stringify(published)).not.toContain("correctOptionIds");
  expect(JSON.stringify(published)).not.toContain('"explanation"');
  expect(JSON.stringify(published)).not.toContain("publishedContent");
  state.courses[0].visibility = "personal";
  expect(await repository.listCatalog(reader)).toEqual([]);
  expect(await repository.findPublishedCourse(reader, id)).toBeNull();
  state.courses[0].visibility = "cohort";
  state.courses[0].moderationStatus = "withdrawn";
  expect(await repository.listCatalog(reader)).toEqual([]);
  expect(await repository.findPublishedCourse(reader, id)).toBeNull();
});
it("rejects callers without an authenticated actor", async () => {
  await expect(repository.listCatalog({ ...reader, id: "" })).rejects.toThrow(
    "sign in",
  );
  await expect(
    repository.findPublishedCourse({ ...reader, id: "" }, "example"),
  ).rejects.toThrow("sign in");
});
