-- Private student-to-teacher annotations on a specific lesson content block.

create table content_annotations (
  id text primary key,
  course_id text not null,
  course_version integer not null check (course_version > 0),
  lesson_id text not null,
  block_id text not null,
  student_id text not null references "user"(id) on delete cascade,
  quote text not null default '' check (char_length(quote) <= 1000),
  category text not null check (
    category in ('question', 'unclear', 'possible_error', 'outdated')
  ),
  message text not null check (char_length(message) between 1 and 3000),
  status text not null default 'open' check (
    status in ('open', 'replied', 'resolved')
  ),
  teacher_reply text,
  replied_by text references "user"(id) on delete set null,
  replied_at timestamptz,
  student_seen_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (course_id, course_version)
    references course_revisions(course_id, version) on delete cascade,
  check (
    (status = 'open' and teacher_reply is null and replied_by is null
      and replied_at is null)
    or (status in ('replied', 'resolved') and replied_by is not null
      and replied_at is not null)
  )
);

create index content_annotations_course_idx
  on content_annotations(course_id, course_version, created_at desc);

create index content_annotations_student_idx
  on content_annotations(student_id, created_at desc);

create index content_annotations_open_idx
  on content_annotations(course_id, status)
  where status = 'open';
