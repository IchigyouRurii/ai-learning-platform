import { ZodError } from "zod";

export function actionError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  )
    throw error;
  if (error instanceof ZodError)
    return error.issues[0]?.message ?? "输入格式不正确。";
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}
