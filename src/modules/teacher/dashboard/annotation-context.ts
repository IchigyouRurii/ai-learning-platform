import type { Course } from "@/shared/contracts";

export function annotationContext(course: Course) {
  return Object.fromEntries(
    course.lessons.flatMap((lesson) =>
      lesson.blocks.map((block) => [
        block.id,
        {
          lessonTitle: lesson.title,
          label:
            block.type === "text"
              ? block.body.replace(/\s+/g, " ").slice(0, 80)
              : block.type === "activity"
                ? block.activity.title
                : block.type,
        },
      ]),
    ),
  );
}
