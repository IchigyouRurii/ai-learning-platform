import { z } from "zod";
import type { Role } from "../platform";

export const idSchema = z.string().trim().min(1).max(200);
export const versionSchema = z.number().int().positive();
export const timestampSchema = z.iso.datetime({ offset: true });
export const roleSchema = z.enum(["student", "teacher", "admin"]);
export const emptyInputSchema = z.strictObject({});
export const pageInputSchema = z.strictObject({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export const featureErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "DEPENDENCY_UNAVAILABLE",
  "NOT_IMPLEMENTED",
  "INTERNAL_ERROR",
]);
export type FeatureErrorCode = z.infer<typeof featureErrorCodeSchema>;
// Compatible with legacy ActionResult's string error; new operations require a code.
export type FeatureResult<T> =
  { ok: true; data: T } | { ok: false; error: string; code: FeatureErrorCode };

export type FeatureStatus = "reserved" | "implemented";

export interface FeatureDefinition {
  input: z.ZodType;
  output: z.ZodType;
  roles: readonly Role[];
  resourcePolicy: string;
  status: FeatureStatus;
}

export function feature<
  I extends z.ZodType,
  O extends z.ZodType,
  S extends FeatureStatus = "reserved",
>(
  input: I,
  output: O,
  roles: readonly Role[],
  resourcePolicy: string,
  status: S = "reserved" as S,
) {
  return { input, output, roles, resourcePolicy, status };
}
export type FeatureInput<D extends FeatureDefinition> = z.input<D["input"]>;
export type FeatureOutput<D extends FeatureDefinition> = z.output<D["output"]>;

export const memberViewSchema = z.object({
  id: idSchema,
  name: z.string(),
  role: roleSchema,
});
