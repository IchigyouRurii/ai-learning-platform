"use client";
import { CourseGenerator } from "@/modules/course-generation/components/course-generator";
/** Compatibility entry: keep one shared creation workflow. */
export function CourseBuilder() {
  return <CourseGenerator mode="teacher" />;
}
