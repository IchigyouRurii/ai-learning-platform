import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedState } from "@/shared/database/seed";

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const pool = { query };
  const getPool = vi.fn(() => pool);
  const store = { read: vi.fn(), mutate: vi.fn() };
  const createStore = vi.fn(() => store);
  return { query, getPool, store, createStore };
});
vi.mock("@/shared/database/pool", () => ({ getDatabasePool: mocks.getPool }));
vi.mock("@/shared/database/demo-repository", () => ({
  createDemoRepository: mocks.createStore,
}));
const keys = [
  "minicourseLocalPlatform",
  "minicourseNeonPlatform",
  "minicourseLocalPlatformFactory",
  "minicourseNeonPlatformFactory",
  "minicourseNeonPlatformPool",
  "minicourseNeonClassroomPool",
  "minicourseDemoStore",
];
const runtime = globalThis as unknown as Record<string, unknown>;
const actor = { id: "demo-teacher", role: "teacher" as const, name: "Teacher" };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of keys) delete runtime[key];
  vi.stubEnv("APP_MODE", "neon");
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.store.read.mockResolvedValue(createSeedState());
});
afterEach(() => {
  for (const key of keys) delete runtime[key];
  vi.unstubAllEnvs();
});

describe("repository cache across hot updates", () => {
  it("replaces a legacy Neon singleton with missing catalog methods", async () => {
    const legacy = { getWorkspace: vi.fn() };
    runtime.minicourseNeonPlatform = legacy;
    const { getRepository } = await import("@/shared/database");
    const repository = getRepository();
    expect(repository).not.toBe(legacy);
    expect(await repository.listCatalog(actor)).toEqual([]);
    expect(await repository.findPublishedCourse(actor, "example")).toBeNull();
    expect(getRepository()).toBe(repository);
    expect(mocks.getPool).toHaveBeenCalledTimes(2);
  });
  it("refreshes an adapter when its factory reloads, without performing a database write", async () => {
    const first = (await import("@/shared/database")).getRepository();
    vi.resetModules();
    const second = (await import("@/shared/database")).getRepository();
    expect(second).not.toBe(first);
    expect(await second.listCatalog(actor)).toEqual([]);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0]).toMatch(/^select /i);
  });
  it("recovers a legacy demo adapter and retains the same storage queue after another reload", async () => {
    vi.stubEnv("APP_MODE", "demo");
    runtime.minicourseLocalPlatform = { getWorkspace: vi.fn() };
    const first = (await import("@/shared/database")).getRepository();
    const courses = await first.listCatalog(actor);
    expect(courses.length).toBeGreaterThan(0);
    expect(
      await first.findPublishedCourse(actor, courses[0].id),
    ).not.toBeNull();
    vi.resetModules();
    const second = (await import("@/shared/database")).getRepository();
    expect(second).not.toBe(first);
    expect(await second.listCatalog(actor)).toEqual(courses);
    expect(mocks.createStore).toHaveBeenCalledOnce();
    expect(mocks.store.mutate).not.toHaveBeenCalled();
    expect(mocks.getPool).not.toHaveBeenCalled();
  });
});
