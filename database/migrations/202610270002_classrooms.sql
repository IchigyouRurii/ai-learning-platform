-- Classroom grants are separate from direct enrollment; history is retained.
create table if not exists classrooms (
  id text primary key,
  teacher_id text not null references "user"(id),
  name text not null check (length(name) between 1 and 100),
  description text not null default '' check (length(description) <= 2000),
  created_at timestamptz not null default now()
);
-- A shared database may already have the 20261019/20 legacy classroom
-- migrations. Preserve their data and nullable legacy link for old readers;
-- the new source of course grants is the versioned assignment table below.
alter table classrooms add column if not exists course_id text references courses(id);
alter table classrooms alter column course_id drop not null;
create index if not exists classrooms_teacher_idx on classrooms(teacher_id, created_at desc, id);
create table if not exists classroom_members (
  class_id text not null references classrooms(id),
  student_id text not null references "user"(id),
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index if not exists classroom_members_student_idx on classroom_members(student_id, class_id);
create table classroom_join_codes (
  class_id text primary key references classrooms(id),
  token_hash text not null unique,
  expires_at timestamptz not null
);
-- Per-account limits work across server instances and cannot be bypassed by a refresh.
create table classroom_join_attempts (
  student_id text primary key references "user"(id),
  window_start timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);
create table course_assignments (
  id text primary key,
  class_id text not null references classrooms(id),
  course_id text not null,
  course_version integer not null,
  due_at timestamptz,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (class_id, course_id, course_version),
  foreign key (course_id, course_version) references course_revisions(course_id, version)
);
create index course_assignments_class_idx on course_assignments(class_id, assigned_at desc, id) where revoked_at is null;
create index course_assignments_course_idx on course_assignments(course_id, course_version, class_id) where revoked_at is null;
alter table enrollments add column direct_access boolean not null default true;
-- Existing enrollments remain direct grants. New class-only enrollments use false
-- to satisfy historical submission FKs without creating permanent learning access.

-- Backfill valid legacy one-course classes without changing their members or
-- existing enrollment provenance. Legacy enrollments conservatively remain
-- direct grants; their original creation source was not recorded.
insert into course_assignments (id, class_id, course_id, course_version, assigned_at)
select 'legacy-class-' || cl.id, cl.id, c.id, c.published_version, cl.created_at
from classrooms cl join courses c on c.id = cl.course_id
where c.owner_id = cl.teacher_id and c.visibility = 'cohort' and c.status = 'published'
on conflict (class_id, course_id, course_version) do nothing;
insert into enrollments (course_id, student_id, direct_access)
select distinct a.course_id, m.student_id, false from classroom_members m
join course_assignments a on a.class_id = m.class_id and a.revoked_at is null
on conflict do nothing;
