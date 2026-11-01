import { z } from "zod";
import {
  toSafeCourse,
  type Course,
  type CourseDraft,
  type SafeCourse,
} from "./course";

/** Metadata only: never send full author content or answer keys in a catalog. */
export const catalogCourseSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  author: z.string(),
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  lessonCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published"]),
  moderationStatus: z.enum(["active", "withdrawn"]),
});
export type CatalogCourse = z.infer<typeof catalogCourseSchema>;
export type PublishedCourse = CatalogCourse & { content: SafeCourse };

export function toCatalogCourse(course: Course, author: string): CatalogCourse {
  return catalogCourseSchema.parse({
    id: course.id,
    ownerId: course.ownerId,
    author,
    title: course.title,
    description: course.description,
    subject: course.subject,
    lessonCount: course.lessons.length,
    version: course.version,
    status: course.status,
    moderationStatus: course.moderationStatus ?? "active",
  });
}
export function toPublishedCourse(
  course: Course,
  author: string,
): PublishedCourse {
  // Whitelist the draft fields before sanitizing. Never spread Course metadata,
  // which can contain a local unpublished draft or a publishedContent snapshot.
  const content: CourseDraft = {
    title: course.title,
    description: course.description,
    subject: course.subject,
    audience: course.audience,
    goals: course.goals,
    lessons: course.lessons,
  };
  return { ...toCatalogCourse(course, author), content: toSafeCourse(content) };
}
