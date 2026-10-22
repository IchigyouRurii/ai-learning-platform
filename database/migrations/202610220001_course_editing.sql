-- Draft revision counter supports optimistic locking when authors edit a course
-- after it has already been published. Published snapshots stay immutable in
-- course_revisions; draft_content holds the next candidate revision.
alter table courses
  add column draft_revision integer not null default 1
  check (draft_revision > 0);

-- Personal courses belong to one student and are reached through the normal
-- enrollment table; no separate access table is required.
create index if not exists courses_personal_owner_idx
  on courses(owner_id, visibility);
