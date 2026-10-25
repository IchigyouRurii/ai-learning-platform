import "server-only";

// Shared business capability. Callers enforce identity and ownership before
// invoking it. New generation workflows have their own reserved contracts.
export { generateCourse } from "./server/generate";
export { parseGeneratedCourse } from "./server/parse-generated";
export { rewriteText } from "./server/rewrite";
export {
  catalogItem,
  generateLearningPath,
  pathProfileSchema,
  validateAgainstCatalog,
} from "./server/path";
export type {
  GeneratedPath,
  PathCatalogItem,
  PathProfile,
} from "./server/path";
