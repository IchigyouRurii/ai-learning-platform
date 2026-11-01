import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAll: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.getAll }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/config", () => ({
  getAppMode: () => "neon",
  isAuthConfigured: () => true,
}));
vi.mock("@/modules/platform/server/auth", () => ({
  getAuth: () => ({ api: { getSession: mocks.getSession } }),
}));
import {
  getCurrentUser,
  getSessionState,
} from "@/modules/platform/server/identity";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAll.mockReturnValue([
    { name: "minicourse.session_token", value: "test-only" },
  ]);
  mocks.getSession.mockReset();
});
it("returns an unavailable state when the session backend fails", async () => {
  mocks.getSession.mockRejectedValue({
    statusCode: 500,
    body: { code: "FAILED_TO_GET_SESSION" },
  });
  expect(await getSessionState()).toEqual({
    status: "unavailable",
    user: null,
  });
  expect(mocks.getSession).toHaveBeenCalledTimes(2);
});
it("redirects a protected page to recovery without granting a role", async () => {
  mocks.getSession.mockRejectedValue({
    statusCode: 500,
    body: { code: "FAILED_TO_GET_SESSION" },
  });
  await expect(getCurrentUser()).rejects.toThrow(
    "REDIRECT:/login?auth=unavailable",
  );
});
it("preserves the verified role after a transient failure", async () => {
  const user = { id: "teacher-1", name: "Teacher", role: "teacher" };
  mocks.getSession
    .mockRejectedValueOnce({
      statusCode: 500,
      body: { code: "FAILED_TO_GET_SESSION" },
    })
    .mockResolvedValueOnce({ user });
  expect(await getSessionState()).toEqual({ status: "authenticated", user });
});
it("does not query the backend without a session cookie", async () => {
  mocks.getAll.mockReturnValue([]);
  expect(await getSessionState()).toEqual({ status: "anonymous", user: null });
  expect(mocks.getSession).not.toHaveBeenCalled();
});
it("rejects an unknown account role rather than treating it as a valid user", async () => {
  mocks.getSession.mockResolvedValue({
    user: { id: "user-1", name: "User", role: "superuser" },
  });
  await expect(getSessionState()).rejects.toThrow("Invalid account role");
});
