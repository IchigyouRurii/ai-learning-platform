-- Neon / PostgreSQL application schema. Auth tables are created by Better Auth
-- before this migration. Executed inside a transaction by scripts/db/migrate.ts.

alter table "user" add constraint minicourse_user_role_check
  check (role in ('student', 'teacher', 'admin'));

create table courses (
  id text primary key,
  owner_id text not null references "user"(id),
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'cohort' check (visibility in ('cohort', 'personal')),
  version integer not null default 1 check (version > 0),
  published_version integer,
  draft_content jsonb not null check (jsonb_typeof(draft_content) = 'object'),
  seed_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, seed_key),
  check ((status = 'published') = (published_version is not null))
);

create table course_revisions (
  course_id text not null references courses(id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null,
  published_at timestamptz not null default now(),
  primary key (course_id, version)
);

alter table courses add constraint minicourse_published_revision_fk
  foreign key (id, published_version) references course_revisions(course_id, version)
  deferrable initially deferred;

create table enrollments (
  course_id text not null references courses(id) on delete cascade,
  student_id text not null references "user"(id),
  joined_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create table submissions (
  id text primary key,
  course_id text not null,
  course_version integer not null,
  activity_id text not null,
  student_id text not null,
  answer text not null,
  ai_feedback text not null,
  created_at timestamptz not null default now(),
  foreign key (course_id, course_version) references course_revisions(course_id, version),
  foreign key (course_id, student_id) references enrollments(course_id, student_id)
);

create table teacher_feedback (
  id text primary key,
  course_id text not null,
  student_id text not null,
  teacher_id text not null references "user"(id),
  message text not null,
  created_at timestamptz not null default now(),
  foreign key (course_id, student_id) references enrollments(course_id, student_id)
);

create table learning_profiles (
  user_id text primary key references "user"(id),
  background text,
  goals jsonb not null default '[]'::jsonb,
  learning_path jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table generation_jobs (
  id text primary key,
  owner_id text not null references "user"(id),
  kind text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  input jsonb not null,
  result jsonb,
  created_at timestamptz not null default now()
);

create index courses_owner_idx on courses(owner_id);
create index courses_catalog_idx on courses(status, visibility, created_at desc);
create index enrollments_student_idx on enrollments(student_id);
create index submissions_progress_idx on submissions(course_id, course_version, student_id, activity_id);
create index feedback_student_idx on teacher_feedback(student_id, course_id);

-- Neon is accessed only by the server using DATABASE_URL, never from browser
-- code. Authorization is enforced by platform services and guarded SQL writes.
-- Do not grant direct public access to these tables via an external Data API.
