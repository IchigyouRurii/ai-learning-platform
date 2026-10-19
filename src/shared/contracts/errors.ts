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
    return error.issues[0]?.message ?? "Invalid input format.";
  return error instanceof Error
    ? error.message
    : "Action failed. Please try again.";
}
