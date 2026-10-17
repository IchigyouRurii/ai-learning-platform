-- Supabase/Postgres starter. Not applied by the Next.js demo runtime.
-- Review in a development project before use. RLS is fail-closed until policies
-- are implemented and tested alongside real authentication.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  visibility text not null default 'cohort' check (visibility in ('cohort', 'personal')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  draft_content jsonb not null,
  published_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_revisions (
  course_id uuid not null references public.courses(id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null,
  published_at timestamptz not null default now(),
  primary key (course_id, version)
);
alter table public.courses add constraint published_revision_fk
  foreign key (id, published_version) references public.course_revisions(course_id, version) deferrable initially deferred;

create table public.enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  course_version integer not null,
  activity_id text not null,
  student_id uuid not null references public.profiles(id),
  answer text not null,
  ai_feedback text,
  created_at timestamptz not null default now(),
  foreign key (course_id, course_version) references public.course_revisions(course_id, version),
  foreign key (course_id, student_id) references public.enrollments(course_id, student_id)
);

create table public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  student_id uuid not null,
  teacher_id uuid not null references public.profiles(id),
  message text not null,
  created_at timestamptz not null default now(),
  foreign key (course_id, student_id) references public.enrollments(course_id, student_id)
);

create table public.learning_profiles (
  user_id uuid primary key references public.profiles(id),
  background text,
  goals jsonb not null default '[]'::jsonb,
  learning_path jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  kind text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  input jsonb not null,
  result jsonb,
  created_at timestamptz not null default now()
);

create index courses_owner_idx on public.courses(owner_id);
create index enrollments_student_idx on public.enrollments(student_id);
create index submissions_progress_idx on public.submissions(course_id, course_version, student_id, activity_id);
create index feedback_student_idx on public.teacher_feedback(student_id, course_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_revisions enable row level security;
alter table public.enrollments enable row level security;
alter table public.submissions enable row level security;
alter table public.teacher_feedback enable row level security;
alter table public.learning_profiles enable row level security;
alter table public.generation_jobs enable row level security;

-- No business policies yet: intentionally deny direct anon/authenticated access.
-- Never expose a service_role key to a browser to bypass this missing work.
commit;
