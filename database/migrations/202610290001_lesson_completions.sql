-- Lesson-level completion is separate from activity submissions and quiz scores.
-- The composite foreign key keeps records tied to an immutable published revision.

create table lesson_completions (
  student_id text not null references "user"(id) on delete cascade,
  course_id text not null,
  course_version integer not null check (course_version > 0),
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (student_id, course_id, course_version, lesson_id),
  foreign key (course_id, course_version)
    references course_revisions(course_id, version) on delete cascade
);

create index lesson_completions_course_idx
  on lesson_completions(course_id, course_version, student_id);
