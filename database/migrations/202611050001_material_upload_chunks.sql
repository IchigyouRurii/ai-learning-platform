-- Private, expiring assembly buffer for uploads larger than hosting request limits.
create table course_material_uploads (
  id text primary key,
  owner_id text not null references "user"(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  total_bytes integer not null check (total_bytes > 0 and total_bytes <= 20000000),
  content bytea not null,
  expires_at timestamptz not null default now() + interval '30 minutes',
  check (octet_length(content) <= total_bytes)
);
create index course_material_uploads_owner_idx on course_material_uploads(owner_id);
