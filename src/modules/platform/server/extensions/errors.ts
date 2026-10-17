import "server-only";
import { ZodError } from "zod";
import type {
  FeatureErrorCode,
  FeatureResult,
} from "@/shared/contracts/features";

// Only construct this with a message intended for the user, never raw DB/AI errors.
export class FeatureServiceError extends Error {
  constructor(
    public readonly code: FeatureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FeatureServiceError";
  }
}

export function featureFailure(error: unknown): FeatureResult<never> {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof error.digest === "string" &&
    (error.digest.startsWith("NEXT_REDIRECT") ||
      error.digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  )
    throw error;
  if (error instanceof FeatureServiceError)
    return { ok: false, code: error.code, error: error.message };
  if (error instanceof ZodError)
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: error.issues[0]?.message ?? "输入格式不正确。",
    };
  return {
    ok: false,
    code: "INTERNAL_ERROR",
    error: "操作暂时无法完成，请稍后重试。",
  };
}
