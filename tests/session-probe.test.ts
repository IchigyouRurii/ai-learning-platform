import { expect, it, vi } from "vitest";
import { probeExistingSession } from "@/modules/platform/auth/session-probe";
it("accepts only a verified session response and does not send a user id or password", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json({ user: { id: "teacher-1", role: "teacher" } }),
    );
  expect(
    await probeExistingSession(new AbortController().signal, request),
  ).toBe("authenticated");
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "/api/auth/get-session",
    expect.objectContaining({ credentials: "same-origin", cache: "no-store" }),
  );
  expect(request.mock.calls[0][1]).not.toHaveProperty("body");
});
it("recognizes restored connectivity without granting access when there is no session", async () => {
  expect(
    await probeExistingSession(
      new AbortController().signal,
      vi.fn().mockResolvedValue(Response.json(null)),
    ),
  ).toBe("anonymous");
});
it("keeps dependency failures and malformed identities unavailable without replaying requests", async () => {
  for (const response of [
    Response.json({}, { status: 503 }),
    Response.json({ user: { id: "x", role: "invented" } }),
    Response.json({}),
  ]) {
    const request = vi.fn().mockResolvedValue(response);
    expect(
      await probeExistingSession(new AbortController().signal, request),
    ).toBe("unavailable");
    expect(request).toHaveBeenCalledOnce();
  }
  const request = vi.fn().mockRejectedValue(new Error("network unavailable"));
  expect(
    await probeExistingSession(new AbortController().signal, request),
  ).toBe("unavailable");
  expect(request).toHaveBeenCalledOnce();
});
