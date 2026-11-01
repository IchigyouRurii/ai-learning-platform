import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("@/modules/platform", () => ({ getSessionState: mocks.state }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/config", () => ({
  getAppMode: () => "neon",
  isAuthConfigured: () => true,
}));
vi.mock("@/modules/platform/auth/auth-form", () => ({ AuthForm: () => null }));
import HomePage from "@/app/page";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.mockResolvedValue({ status: "unavailable", user: null });
});
it("redirects the home page to a recovery URL instead of crashing", async () => {
  await expect(HomePage()).rejects.toThrow("REDIRECT:/login?auth=unavailable");
});
it("does not repeat session queries on the recovery redirect", async () => {
  const result = await LoginPage({
    searchParams: Promise.resolve({ auth: "unavailable" }),
  });
  expect(result.props.serviceUnavailable).toBe(true);
  expect(mocks.state).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("renders both auth forms with an unavailable state when a direct session check fails", async () => {
  const login = await LoginPage({ searchParams: Promise.resolve({}) });
  const register = await RegisterPage();
  expect(login.props.serviceUnavailable).toBe(true);
  expect(register.props.serviceUnavailable).toBe(true);
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("still redirects a verified signed-in user normally", async () => {
  mocks.state.mockResolvedValue({
    status: "authenticated",
    user: { id: "teacher", role: "teacher", name: "Teacher" },
  });
  await expect(
    LoginPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("REDIRECT:/");
});
