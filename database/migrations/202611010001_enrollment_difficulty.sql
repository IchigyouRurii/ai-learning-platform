-- One active learning difficulty per student/course. Existing enrollments and
-- records retain Beginner ownership, without changing any published snapshot.
alter table enrollments add column difficulty text not null default 'beginner'
  check (difficulty in ('beginner','advanced','expert'));
alter table submissions add column difficulty text not null default 'beginner'
  check (difficulty in ('beginner','advanced','expert'));
alter table lesson_completions add column difficulty text not null default 'beginner'
  check (difficulty in ('beginner','advanced','expert'));
alter table lesson_completions drop constraint lesson_completions_pkey;
alter table lesson_completions add primary key(student_id,course_id,course_version,lesson_id,difficulty);
create index submissions_learning_level_idx on submissions(student_id,course_id,course_version,difficulty);
