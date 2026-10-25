-- Persist AI interaction history and every saved learning path. Existing
-- courses/submissions already persist; these tables add the missing history.
create table generation_records (
  id text primary key,
  owner_id text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('course', 'rewrite', 'path')),
  course_id text references courses(id) on delete cascade,
  input jsonb not null,
  result jsonb,
  created_at timestamptz not null default now()
);

create index generation_records_owner_idx
  on generation_records(owner_id, created_at desc);
create index generation_records_course_idx
  on generation_records(course_id, created_at desc);

create table learning_paths (
  id text primary key,
  owner_id text not null references "user"(id) on delete cascade,
  title text not null,
  steps jsonb not null,
  created_at timestamptz not null default now()
);

create index learning_paths_owner_idx
  on learning_paths(owner_id, created_at desc);
