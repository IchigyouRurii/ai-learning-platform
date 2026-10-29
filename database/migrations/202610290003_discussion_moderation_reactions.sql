-- Soft-delete discussion messages and add one-reaction-per-user-per-message.

alter table discussion_questions
  add column deleted_at timestamptz,
  add column deleted_by text references "user"(id) on delete set null;

alter table discussion_replies
  add column deleted_at timestamptz,
  add column deleted_by text references "user"(id) on delete set null;

create table discussion_reactions (
  id text primary key,
  question_id text references discussion_questions(id) on delete cascade,
  reply_id text references discussion_replies(id) on delete cascade,
  user_id text not null references "user"(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'smile', 'confused', 'doubt')),
  created_at timestamptz not null default now(),
  constraint discussion_reactions_one_target check (
    (question_id is not null and reply_id is null)
    or (question_id is null and reply_id is not null)
  ),
  unique (user_id, question_id),
  unique (user_id, reply_id)
);

create index discussion_reactions_question_idx
  on discussion_reactions(question_id)
  where question_id is not null;

create index discussion_reactions_reply_idx
  on discussion_reactions(reply_id)
  where reply_id is not null;
