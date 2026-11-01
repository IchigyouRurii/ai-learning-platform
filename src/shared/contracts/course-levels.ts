import {
  COURSE_LEVELS,
  courseLevel,
  type CourseDraft,
  type CourseLevel,
  type Lesson,
  type LearnerLesson,
} from "./course";

/** Old immutable publications keep their original lesson/activity identities. */
export function lessonsAtLevel<T extends Lesson | LearnerLesson>(
  lessons: T[],
  level: CourseLevel,
): T[] {
  if (lessons.every((lesson) => !lesson.difficulty)) return lessons;
  return lessons.filter((lesson) => courseLevel(lesson.difficulty) === level);
}

/** Clone legacy author drafts only; never write into an existing publication. */
export function editableCourseLevels(course: CourseDraft): CourseDraft {
  if (course.lessons.some((lesson) => lesson.difficulty)) return course;
  return {
    ...course,
    lessons: COURSE_LEVELS.flatMap((difficulty) =>
      course.lessons.map((lesson) => {
        const id = (value: string) =>
          difficulty === "beginner" ? value : `${difficulty}:${value}`;
        return {
          ...lesson,
          difficulty,
          id: id(lesson.id),
          blocks: lesson.blocks.map((block) =>
            block.type !== "activity"
              ? { ...block, id: id(block.id) }
              : {
                  ...block,
                  id: id(block.id),
                  activity: {
                    ...block.activity,
                    id: id(block.activity.id),
                    ...(block.activity.questions
                      ? {
                          questions: block.activity.questions.map(
                            (question) => ({
                              ...question,
                              id: id(question.id),
                              options: question.options.map((option) => ({
                                ...option,
                                id: id(option.id),
                              })),
                              correctOptionIds:
                                question.correctOptionIds.map(id),
                            }),
                          ),
                        }
                      : {}),
                  },
                },
          ),
        };
      }),
    ),
  };
}
