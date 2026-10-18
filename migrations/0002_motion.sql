-- Motion studio pages. Rows are unowned: one shared studio, no accounts.
create table if not exists pages (
  id          text primary key,
  parent_id   text references pages (id) on delete cascade,
  title       text not null default 'Untitled',
  icon        text not null default 'file-text',
  cover       text not null default 'none',
  content     jsonb not null default '[]'::jsonb,
  favorite    boolean not null default false,
  position    integer not null default 0,
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists pages_parent_idx on pages (parent_id, position);
create index if not exists pages_updated_idx on pages (updated_at desc);

insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
values (
  'welcome',
  null,
  'Welcome to Motion',
  'compass',
  'wash',
  true,
  0,
  'live',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Pages, in motion'),
    jsonb_build_object('type', 'paragraph', 'content', 'Motion is a block studio. Write in the page, nest pages in the sidebar, and move work across idea, draft, and live on the board.'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Type / on an empty line for headings, lists, quotes, tables, and code.'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Drag the handle beside a block to reorder it. Tab nests a block under the one above.'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Open the command menu with ⌘K or Ctrl+K to jump, create, or switch to the board.'),
    jsonb_build_object('type', 'checkListItem', 'props', jsonb_build_object('checked', true), 'content', 'Read this page'),
    jsonb_build_object('type', 'checkListItem', 'props', jsonb_build_object('checked', false), 'content', 'Give a page an icon and a cover'),
    jsonb_build_object('type', 'checkListItem', 'props', jsonb_build_object('checked', false), 'content', 'Drop a code block into a draft'),
    jsonb_build_object('type', 'quote', 'content', 'This studio is shared. Anyone who opens Motion can read and edit. Do not put private notes here.')
  )
)
on conflict (id) do nothing;

insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
values (
  'studio',
  null,
  'The studio',
  'layers',
  'none',
  false,
  1,
  'draft',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'How the desk is built'),
    jsonb_build_object('type', 'paragraph', 'content', 'Walnut sidebar, paper page, one copper accent. Copper marks the action, not the decoration.'),
    jsonb_build_object('type', 'numberedListItem', 'content', 'Pages — a tree, with favorites pinned above it.'),
    jsonb_build_object('type', 'numberedListItem', 'content', 'Board — the same pages, grouped as idea, draft, or live.'),
    jsonb_build_object('type', 'numberedListItem', 'content', 'Editor — BlockNote, so slash commands and drag handles are real, not a sketch.'),
    jsonb_build_object('type', 'paragraph', 'content', 'Pages live in Neon. The application source lives on GitHub. Publishing runs on Vercel. There is one studio, and it is shared.')
  )
)
on conflict (id) do nothing;

insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
values (
  'changelog',
  null,
  'Changelog',
  'flag',
  'ink',
  false,
  2,
  'live',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Motion 1'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Nested pages, favorites, and a command menu'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Block editor with slash commands, to-dos, quotes, and code'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Board for idea, draft, and live'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Autosave into Postgres'),
    jsonb_build_object('type', 'paragraph', 'content', 'Accounts are off on purpose. The studio is a shared desk, not a private notebook.')
  )
)
on conflict (id) do nothing;

insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
values (
  'blocks',
  'studio',
  'Blocks and slash',
  'pen-line',
  'none',
  true,
  0,
  'live',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'The blocks'),
    jsonb_build_object('type', 'paragraph', 'content', 'Press / on an empty line. These are the ones you will use every day.'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Text, three levels of heading, bullets, numbers, and to-dos'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Quote, divider, and table'),
    jsonb_build_object('type', 'bulletListItem', 'content', 'Code block, with a language'),
    jsonb_build_object(
      'type', 'codeBlock',
      'props', jsonb_build_object('language', 'markdown'),
      'content', $code$# Heading
- A list
1. A numbered step
> A quote$code$
    ),
    jsonb_build_object('type', 'divider'),
    jsonb_build_object('type', 'quote', 'content', 'Markdown shortcuts work too. Try #, -, or 1. followed by a space.')
  )
)
on conflict (id) do nothing;

insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
values (
  'code',
  'studio',
  'Code, on purpose',
  'cuboid',
  'copper',
  false,
  1,
  'draft',
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Code lives beside the prose'),
    jsonb_build_object('type', 'paragraph', 'content', 'A code block is just another block. Drag it, nest it, and name the language. It saves with the page.'),
    jsonb_build_object(
      'type', 'codeBlock',
      'props', jsonb_build_object('language', 'typescript'),
      'content', $stack$export const stack = {
  editor: "BlockNote",
  database: "Neon",
  host: "Vercel",
  source: "GitHub",
} as const;$stack$
    ),
    jsonb_build_object('type', 'paragraph', 'content', 'The repository is the source of the app. Neon is the source of the pages. They are not the same thing, and that is the point.')
  )
)
on conflict (id) do nothing;
