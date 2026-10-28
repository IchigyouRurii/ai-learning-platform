-- Moderation lives on the course row so enrollment/submission guards and
-- moderation can lock the same row. Publishing never resets these fields.
alter table courses
  add column moderation_status text not null default 'active'
    check (moderation_status in ('active', 'withdrawn')),
  add column moderation_reason text not null default '',
  add column moderated_by text references "user"(id),
  add column moderated_at timestamptz,
  add constraint courses_moderation_check check (
    moderation_status = 'active' or (
      visibility = 'cohort' and length(trim(moderation_reason)) > 0
      and moderated_by is not null and moderated_at is not null
    )
  );

create table admin_audit_events (
  id text primary key,
  admin_id text not null references "user"(id),
  action text not null check (action in ('user.role_changed', 'course.withdrawn')),
  target_id text not null,
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);
create index admin_audit_created_idx on admin_audit_events(created_at desc);
create index courses_moderation_idx on courses(moderation_status, created_at desc);
