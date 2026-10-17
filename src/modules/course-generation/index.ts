import "server-only";

// Shared business capability. Callers enforce identity and ownership before
// invoking it. New generation workflows have their own reserved contracts.
export { generateCourse } from "./server/generate";
export { parseGeneratedCourse } from "./server/parse-generated";
