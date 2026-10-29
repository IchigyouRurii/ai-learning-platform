-- Course-scoped public Q&A. Every question and reply is visible only to
-- students enrolled in the course and to the teacher who owns it.

create table discussion_questions (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  course_version integer not null check (course_version > 0),
  lesson_id text,
  student_id text not null references "user"(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 6000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index discussion_questions_course_idx
  on discussion_questions(course_id, created_at desc);

create index discussion_questions_student_idx
  on discussion_questions(student_id, created_at desc);

create table discussion_replies (
  id text primary key,
  question_id text not null references discussion_questions(id) on delete cascade,
  author_id text not null references "user"(id) on delete cascade,
  author_role text not null check (author_role in ('student', 'teacher')),
  message text not null check (char_length(message) between 1 and 6000),
  created_at timestamptz not null default now()
);

create index discussion_replies_question_idx
  on discussion_replies(question_id, created_at);
