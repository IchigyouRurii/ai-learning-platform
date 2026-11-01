import { describe, expect, it, vi } from "vitest";
import {
  authenticationFailureCode,
  readSessionWithRetry,
} from "@/modules/platform/server/session-read";

const unavailable = {
  statusCode: 500,
  body: { code: "FAILED_TO_GET_SESSION" },
};
describe("session read recovery", () => {
  it("retries once and preserves the server-verified session on recovery", async () => {
    const session = { user: { id: "teacher-1", role: "teacher" } };
    const read = vi
      .fn()
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValueOnce(session);
    expect(await readSessionWithRetry(read)).toEqual({
      available: true,
      session,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("fails closed after two failures instead of fabricating a demo user", async () => {
    const read = vi.fn().mockRejectedValue(unavailable);
    expect(await readSessionWithRetry(read)).toEqual({
      available: false,
      session: null,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("does not retry an expired or missing session", async () => {
    const read = vi.fn().mockResolvedValue(null);
    expect(await readSessionWithRetry(read)).toEqual({
      available: true,
      session: null,
    });
    expect(read).toHaveBeenCalledOnce();
    const expired = vi
      .fn()
      .mockRejectedValue({
        statusCode: 401,
        body: { code: "FAILED_TO_GET_SESSION" },
      });
    expect(await readSessionWithRetry(expired)).toEqual({
      available: true,
      session: null,
    });
    expect(expired).toHaveBeenCalledOnce();
  });
  it.each(["42P01", "42703", "28P01", "28000"])(
    "does not repeatedly retry a schema or credential failure: %s",
    async (code) => {
      const read = vi.fn().mockRejectedValue({ code });
      expect(await readSessionWithRetry(read)).toEqual({
        available: false,
        session: null,
      });
      expect(read).toHaveBeenCalledOnce();
    },
  );
  it("does not swallow application errors or Next redirect control flow", async () => {
    for (const error of [
      new TypeError("Unexpected bug"),
      { digest: "NEXT_REDIRECT;replace;/login;307;" },
    ]) {
      const read = vi.fn().mockRejectedValue(error);
      await expect(readSessionWithRetry(read)).rejects.toBe(error);
      expect(read).toHaveBeenCalledOnce();
    }
  });
  it("extracts safe diagnostic codes without including credentials or SQL", () => {
    const error = Object.assign(
      new Error("postgresql://owner:secret@host/database SELECT private_data"),
      { code: "ECONNRESET" },
    );
    expect(authenticationFailureCode(new AggregateError([error]))).toBe(
      "ECONNRESET",
    );
    expect(
      authenticationFailureCode(
        new Error("timeout exceeded when trying to connect"),
      ),
    ).toBe("CONNECTION_TIMEOUT");
    expect(
      authenticationFailureCode(new Error("private unknown message")),
    ).toBeNull();
  });
});
