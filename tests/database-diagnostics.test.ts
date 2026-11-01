import { expect, it } from "vitest";
import { databaseFailureDiagnostic } from "@/shared/database/diagnostics";

it.each([
  [new Error("timeout exceeded when trying to connect"), "CONNECTION_TIMEOUT"],
  [{ code: "ETIMEDOUT" }, "ETIMEDOUT"],
  [{ code: "28P01" }, "28P01"],
  [{ code: "42P01" }, "42P01"],
])(
  "classifies connection, credential and schema failures without raw messages",
  (error, code) => {
    expect(databaseFailureDiagnostic(error).code).toBe(code);
  },
);
it("finds a safe code in aggregate causes", () => {
  expect(
    databaseFailureDiagnostic(
      new AggregateError([{ cause: { code: "ECONNRESET" } }]),
    ).code,
  ).toBe("ECONNRESET");
});
it("does not disclose credentials or SQL even in an unknown error", () => {
  for (const error of [
    new Error("postgresql://owner:secret@example/db SELECT private_data"),
    Object.assign(new Error("secret"), { code: "28P01" }),
  ]) {
    const text = JSON.stringify(databaseFailureDiagnostic(error));
    expect(text).not.toContain("secret");
    expect(text).not.toContain("postgresql:");
    expect(text).not.toContain("private_data");
  }
});
it("returns a stable unknown diagnostic for unsupported errors", () => {
  expect(databaseFailureDiagnostic(null).code).toBe("UNKNOWN");
});
