-- Archive preserves class membership, assignments and all learning history.
alter table classrooms
  add column status text not null default 'active' check (status in ('active', 'archived')),
  add column archive_reason text not null default '',
  add column archived_by text references "user"(id),
  add column archived_at timestamptz,
  add constraint classrooms_archive_check check (
    (status = 'active' and archive_reason = '' and archived_by is null and archived_at is null)
    or (status = 'archived' and length(trim(archive_reason)) between 1 and 2000 and archived_by is not null and archived_at is not null)
  );
create index classrooms_status_idx on classrooms(status, created_at desc, id);
alter table admin_audit_events drop constraint admin_audit_events_action_check;
alter table admin_audit_events add constraint admin_audit_events_action_check
  check (action in ('user.role_changed', 'course.withdrawn', 'class.archived', 'class.restored', 'class.member_removed', 'class.assignment_removed'));
