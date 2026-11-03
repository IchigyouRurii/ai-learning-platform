-- Uploaded course materials. The extracted text feeds AI generation; the file
-- bytes are served by /api/materials/[id] after an authorization check.
create table if not exists course_materials (
  id text primary key,
  owner_id text not null references "user"(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 20000000),
  content bytea not null,
  extracted_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists course_materials_owner_idx
  on course_materials(owner_id, created_at desc);
