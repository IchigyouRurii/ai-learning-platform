import type { LearnerLesson } from "@/shared/contracts";
export function CourseOutline({
  title,
  description,
  level,
  lessons,
}: {
  title: string;
  description: string;
  level: string;
  lessons: LearnerLesson[];
}) {
  return (
    <div className="draft-editor">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <p className="form-hint">
        {lessons.length} lessons · {level}
      </p>
      <ul className="preview-lessons">
        {lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <strong>
              Lesson {index + 1}: {lesson.title}
            </strong>
            <span className="muted">
              {lesson.blocks
                .map((block) =>
                  block.type === "activity" ? block.activity.type : block.type,
                )
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
