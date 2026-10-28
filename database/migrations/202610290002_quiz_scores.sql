-- Structured quiz scores. Reflection submissions keep both columns null.
-- The best attempt per quiz is used for class progress; every attempt remains.

alter table submissions
  add column score integer,
  add column max_score integer;

alter table submissions add constraint submissions_score_check check (
  (score is null and max_score is null)
  or (
    score is not null
    and max_score is not null
    and max_score > 0
    and score >= 0
    and score <= max_score
  )
);

create index submissions_quiz_score_idx
  on submissions(course_id, course_version, student_id, activity_id)
  where score is not null;
