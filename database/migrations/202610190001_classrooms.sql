-- Classrooms and teacher-managed student membership. Auth tables are created by
-- Better Auth before this migration. Student-only membership is enforced by the
-- services and guarded inserts; the "user" role is server-owned.

create table classrooms (
  id text primary key,
  teacher_id text not null references "user"(id),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now()
);

create table classroom_members (
  class_id text not null references classrooms(id) on delete cascade,
  student_id text not null references "user"(id),
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index classrooms_teacher_idx on classrooms(teacher_id, created_at desc);
create index classroom_members_student_idx on classroom_members(student_id);
