import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  featureFailure,
  FeatureServiceError,
} from "@/modules/platform/server/extensions/errors";

describe("feature failure boundary", () => {
  it("keeps explicit safe domain errors while hiding unexpected provider/database details", () => {
    expect(
      featureFailure(
        new FeatureServiceError("CONFLICT", "草稿已被其他成员修改。"),
      ),
    ).toEqual({ ok: false, code: "CONFLICT", error: "草稿已被其他成员修改。" });
    const result = featureFailure(
      new Error("postgresql://private-user:secret-password@database/private"),
    );
    expect(result).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(JSON.stringify(result)).not.toContain("secret-password");
    expect(JSON.stringify(result)).not.toContain("postgresql");
  });
  it("maps validation failures and preserves Next navigation control flow", () => {
    const validation = z.string().min(1, "不能为空。").safeParse("");
    if (validation.success) throw new Error("fixture");
    expect(featureFailure(validation.error)).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      error: "不能为空。",
    });
    const redirect = { digest: "NEXT_REDIRECT;replace;/login;307;" };
    expect(() => featureFailure(redirect)).toThrow();
    const notFound = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
    expect(() => featureFailure(notFound)).toThrow();
  });
});
