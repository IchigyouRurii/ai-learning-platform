import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  create: vi.fn(() => ({ api: { getSession: vi.fn() } })),
}));
vi.mock("@/shared/database/pool", () => ({ getDatabasePool: mocks.pool }));
vi.mock("@/modules/platform/server/auth-config", () => ({
  createAuth: mocks.create,
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
it("rebinds authentication to the current pool after the old pool is replaced", async () => {
  const first = { query: vi.fn() },
    second = { query: vi.fn() };
  mocks.pool.mockReturnValue(first);
  const { getAuth } = await import("@/modules/platform/server/auth");
  const original = getAuth();
  expect(getAuth()).toBe(original);
  expect(mocks.create).toHaveBeenCalledOnce();
  mocks.pool.mockReturnValue(second);
  expect(getAuth()).not.toBe(original);
  expect(mocks.create).toHaveBeenLastCalledWith(second);
});
