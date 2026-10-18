-- Pages belong to an account. The previous unowned studio was development data.
drop table if exists pages;

create table pages (
  id           text primary key,
  user_id      text not null,
  parent_id    text references pages (id) on delete cascade,
  title        text not null default 'Untitled',
  icon         text not null default 'file-text',
  cover        text not null default 'none',
  content      jsonb not null default '[]'::jsonb,
  properties   jsonb not null default '[]'::jsonb,
  favorite     boolean not null default false,
  position     integer not null default 0,
  status       text not null default 'draft',
  is_template  boolean not null default false,
  search_text  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists pages_user_idx on pages (user_id, parent_id, position);
create index if not exists pages_user_updated_idx on pages (user_id, updated_at desc);
