-- AI-generated extra lessons are recorded in generation history alongside
-- course, rewrite and path records.
alter table generation_records
  drop constraint if exists generation_records_kind_check;
alter table generation_records
  add constraint generation_records_kind_check
  check (kind in ('course', 'rewrite', 'path', 'lesson'));
