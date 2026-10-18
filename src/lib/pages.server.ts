import { getSql } from "@/lib/db";
import {
  asBlocks,
  asProperties,
  isCover,
  isIcon,
  isId,
  isStatus,
  searchPlain,
  type Backlink,
  type PageDetail,
  type PagePatch,
  type PageProperty,
  type PageSummary,
  type StudioData,
} from "@/lib/pages";

type SummaryRow = {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  cover: string;
  favorite: boolean;
  position: number;
  status: string;
  is_template: boolean;
  search_text: string;
  updated_at: string;
};

type DetailRow = SummaryRow & { content: unknown; properties: unknown };

function toSummary(row: SummaryRow): PageSummary {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    icon: row.icon,
    cover: row.cover,
    favorite: Boolean(row.favorite),
    position: Number(row.position),
    status: row.status,
    template: Boolean(row.is_template),
    searchText: row.search_text ?? "",
    updatedAt: row.updated_at,
  };
}

const SUMMARY = `
  id, parent_id, title, icon, cover, favorite, position, status, is_template,
  left(search_text, 2000) as search_text,
  to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
`;

export async function loadStudioData(userId: string, pageId: string | null): Promise<StudioData> {
  const sql = await getSql();
  const count = await sql<{ n: number }>`select count(*)::int as n from pages where user_id = ${userId}`;
  if (Number(count[0]?.n ?? 0) === 0) await seedStudio(userId);

  const rows = await sql.query<SummaryRow>(
    `select ${SUMMARY} from pages where user_id = $1 order by position asc, title asc`,
    [userId],
  );
  const pages = rows.map(toSummary);
  if (!pageId) return { pages, page: null };
  const detail = await sql.query<DetailRow>(
    `select ${SUMMARY}, content, properties from pages where user_id = $1 and id = $2`,
    [userId, pageId],
  );
  const row = detail[0];
  if (!row) return { pages, page: null };
  const backlinks = await sql.query<Backlink>(
    `select id, title, icon from pages
     where user_id = $1 and id <> $2 and is_template = false and content::text like $3
     order by updated_at desc
     limit 12`,
    [userId, pageId, `%${pageId}%`],
  );
  const page: PageDetail = {
    ...toSummary(row),
    content: JSON.stringify(asBlocks(row.content)),
    properties: asProperties(row.properties),
    backlinks,
  };
  return { pages, page };
}

async function nextPosition(userId: string, parentId: string | null): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ next: number }>`
    select coalesce(max(position), 0) + 1 as next
    from pages
    where user_id = ${userId}
      and ((${parentId}::text is null and parent_id is null) or parent_id = ${parentId})
  `;
  return Number(rows[0]?.next ?? 1);
}

async function assertParent(userId: string, parentId: string | null) {
  if (!parentId) return;
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from pages where user_id = ${userId} and id = ${parentId} and is_template = false
  `;
  if (!rows[0]) throw new Error("That parent page is gone");
}

async function refreshSearch(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql<{ title: string; content: unknown; properties: unknown }>`
    select title, content, properties from pages where user_id = ${userId} and id = ${id}
  `;
  const row = rows[0];
  if (!row) return;
  const text = searchPlain(row.title, row.content, asProperties(row.properties));
  await sql`update pages set search_text = ${text} where user_id = ${userId} and id = ${id}`;
}

export async function createPageRow(
  userId: string,
  input: { title?: string; parentId?: string | null; icon?: string; status?: string },
): Promise<{ id: string; title: string }> {
  const parentId = input.parentId ?? null;
  if (parentId && !isId(parentId)) throw new Error("Unknown page");
  await assertParent(userId, parentId);
  const title = (input.title ?? "Untitled").trim().slice(0, 180) || "Untitled";
  const icon = input.icon && isIcon(input.icon) ? input.icon : "file-text";
  const status = input.status && isStatus(input.status) ? input.status : "draft";
  const id = crypto.randomUUID();
  const position = await nextPosition(userId, parentId);
  const search = searchPlain(title, [], []);
  const sql = await getSql();
  await sql`
    insert into pages (
      id, user_id, parent_id, title, icon, cover, favorite, position, status, is_template, content, properties, search_text
    )
    values (
      ${id}, ${userId}, ${parentId}, ${title}, ${icon}, ${"none"}, false, ${position}, ${status}, false,
      ${"[]"}::jsonb, ${"[]"}::jsonb, ${search}
    )
  `;
  return { id, title };
}

async function parentChainCycles(userId: string, id: string, parentId: string | null): Promise<boolean> {
  if (!parentId) return false;
  if (parentId === id) return true;
  const sql = await getSql();
  const seen = new Set<string>();
  let current: string | null = parentId;
  while (current) {
    if (current === id || seen.has(current)) return true;
    seen.add(current);
    const rows: { parent_id: string | null }[] = await sql<{ parent_id: string | null }>`
      select parent_id from pages where user_id = ${userId} and id = ${current}
    `;
    current = rows[0]?.parent_id ?? null;
  }
  return false;
}

export async function updatePageRow(userId: string, id: string, patch: PagePatch): Promise<void> {
  if (!isId(id)) throw new Error("Unknown page");
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (patch.title !== undefined) push("title", patch.title);
  if (patch.icon !== undefined) {
    if (!isIcon(patch.icon)) throw new Error("Unknown icon");
    push("icon", patch.icon);
  }
  if (patch.cover !== undefined) {
    if (!isCover(patch.cover)) throw new Error("Unknown cover");
    push("cover", patch.cover);
  }
  if (patch.favorite !== undefined) push("favorite", patch.favorite);
  if (patch.status !== undefined) {
    if (!isStatus(patch.status)) throw new Error("Unknown status");
    push("status", patch.status);
  }
  if (patch.content !== undefined) push("content", JSON.stringify(patch.content));
  if (patch.properties !== undefined) push("properties", JSON.stringify(patch.properties));
  if (patch.parentId !== undefined) {
    if (patch.parentId && !isId(patch.parentId)) throw new Error("Unknown page");
    if (await parentChainCycles(userId, id, patch.parentId)) {
      throw new Error("A page can't sit inside itself");
    }
    if (patch.parentId) await assertParent(userId, patch.parentId);
    push("parent_id", patch.parentId);
  }
  if (!sets.length) return;

  for (const column of ["content", "properties"]) {
    const index = sets.findIndex((set) => set.startsWith(`${column} `));
    if (index >= 0) sets[index] = `${sets[index]}::jsonb`;
  }

  values.push(id, userId);
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update pages set ${sets.join(", ")}, updated_at = now()
     where id = $${values.length - 1} and user_id = $${values.length}
     returning id`,
    values,
  );
  if (!rows[0]) throw new Error("That page is gone");
  if (patch.title !== undefined || patch.content !== undefined || patch.properties !== undefined) {
    await refreshSearch(userId, id);
  }
}

export async function deletePageRow(userId: string, id: string): Promise<{ parentId: string | null }> {
  if (!isId(id)) throw new Error("Unknown page");
  const sql = await getSql();
  const existing = await sql<{ parent_id: string | null }>`
    select parent_id from pages where user_id = ${userId} and id = ${id}
  `;
  if (!existing[0]) throw new Error("That page is gone");
  await sql`delete from pages where user_id = ${userId} and id = ${id}`;
  return { parentId: existing[0].parent_id };
}

export async function duplicatePageRow(userId: string, id: string): Promise<{ id: string }> {
  return copyPage(userId, id, { asTemplate: false, titleSuffix: " copy" });
}

export async function saveTemplateRow(userId: string, id: string): Promise<{ id: string }> {
  return copyPage(userId, id, { asTemplate: true, titleSuffix: " template" });
}

export async function createFromTemplateRow(
  userId: string,
  templateId: string,
  parentId: string | null,
): Promise<{ id: string }> {
  if (!isId(templateId)) throw new Error("Unknown page");
  if (parentId && !isId(parentId)) throw new Error("Unknown page");
  await assertParent(userId, parentId);
  const sql = await getSql();
  const rows = await sql<{
    title: string;
    icon: string;
    cover: string;
    content: unknown;
    properties: unknown;
  }>`
    select title, icon, cover, content, properties
    from pages
    where user_id = ${userId} and id = ${templateId} and is_template = true
  `;
  const source = rows[0];
  if (!source) throw new Error("That template is gone");
  const copyId = crypto.randomUUID();
  const position = await nextPosition(userId, parentId);
  const title = source.title.replace(/\s+template$/, "").slice(0, 180) || "Untitled";
  const properties = asProperties(source.properties);
  const search = searchPlain(title, source.content, properties);
  await sql`
    insert into pages (
      id, user_id, parent_id, title, icon, cover, favorite, position, status, is_template, content, properties, search_text
    )
    values (
      ${copyId},
      ${userId},
      ${parentId},
      ${title},
      ${source.icon},
      ${source.cover},
      false,
      ${position},
      ${"draft"},
      false,
      ${JSON.stringify(asBlocks(source.content))}::jsonb,
      ${JSON.stringify(properties)}::jsonb,
      ${search}
    )
  `;
  return { id: copyId };
}

async function copyPage(
  userId: string,
  id: string,
  options: { asTemplate: boolean; titleSuffix: string },
): Promise<{ id: string }> {
  if (!isId(id)) throw new Error("Unknown page");
  const sql = await getSql();
  const rows = await sql<{
    parent_id: string | null;
    title: string;
    icon: string;
    cover: string;
    status: string;
    content: unknown;
    properties: unknown;
  }>`
    select parent_id, title, icon, cover, status, content, properties
    from pages
    where user_id = ${userId} and id = ${id}
  `;
  const source = rows[0];
  if (!source) throw new Error("That page is gone");
  const copyId = crypto.randomUUID();
  const parentId = options.asTemplate ? null : source.parent_id;
  const position = await nextPosition(userId, parentId);
  const title = `${source.title}${options.titleSuffix}`.slice(0, 180);
  const properties = asProperties(source.properties);
  const search = searchPlain(title, source.content, properties);
  await sql`
    insert into pages (
      id, user_id, parent_id, title, icon, cover, favorite, position, status, is_template, content, properties, search_text
    )
    values (
      ${copyId},
      ${userId},
      ${parentId},
      ${title},
      ${source.icon},
      ${source.cover},
      false,
      ${position},
      ${options.asTemplate ? "draft" : source.status},
      ${options.asTemplate},
      ${JSON.stringify(asBlocks(source.content))}::jsonb,
      ${JSON.stringify(properties)}::jsonb,
      ${search}
    )
  `;
  return { id: copyId };
}

export async function movePageRow(
  userId: string,
  input: { id: string; parentId: string | null; index: number },
): Promise<void> {
  if (!isId(input.id)) throw new Error("Unknown page");
  if (input.parentId && !isId(input.parentId)) throw new Error("Unknown page");
  const sql = await getSql();
  const rows = await sql<{ id: string; parent_id: string | null; position: number; is_template: boolean }>`
    select id, parent_id, position, is_template
    from pages
    where user_id = ${userId}
    order by position asc, title asc
  `;
  const moving = rows.find((row) => row.id === input.id);
  if (!moving || moving.is_template) throw new Error("That page is gone");
  if (input.parentId && !rows.some((row) => row.id === input.parentId && !row.is_template)) {
    throw new Error("That parent page is gone");
  }
  const parentOf = new Map(rows.map((row) => [row.id, row.parent_id]));
  let cursor = input.parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === input.id || seen.has(cursor)) throw new Error("A page can't sit inside itself");
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
  const siblings = rows
    .filter((row) => !row.is_template && row.parent_id === input.parentId && row.id !== input.id)
    .map((row) => row.id);
  const index = Math.max(0, Math.min(input.index, siblings.length));
  siblings.splice(index, 0, input.id);
  for (let i = 0; i < siblings.length; i += 1) {
    await sql`
      update pages
      set parent_id = ${input.parentId}, position = ${i}
      where user_id = ${userId} and id = ${siblings[i]}
    `;
  }
}

async function seedStudio(userId: string) {
  const welcome = crypto.randomUUID();
  const notes = crypto.randomUUID();
  const studio = crypto.randomUUID();
  const template = crypto.randomUUID();
  const place = crypto.randomUUID();
  const welcomeProps: PageProperty[] = [{ id: place, name: "Place", value: "Desk" }];
  const welcomeContent = [
    { type: "heading", props: { level: 2 }, content: "Pages, in motion" },
    {
      type: "paragraph",
      content:
        "This studio is yours. Type / for blocks, including a subpage. Drag a row in the sidebar to nest or reorder it.",
    },
    { type: "subpage", props: { pageId: notes, title: "Field notes" } },
    {
      type: "paragraph",
      content: "Search looks through the writing, not only the title. Present turns headings into slides.",
    },
  ];
  const notesContent = [
    { type: "heading", props: { level: 2 }, content: "Field notes" },
    { type: "checkListItem", props: { checked: false }, content: "Capture one concrete observation" },
    { type: "quote", content: "A backlink appears on any page this one is embedded in." },
  ];
  const studioContent = [
    { type: "heading", props: { level: 2 }, content: "How the desk is built" },
    { type: "bulletListItem", content: "Ask Motion can continue a page, retitle it, or draft a subpage." },
    { type: "bulletListItem", content: "Templates live under the page tree. Use one to start from a shape, not a blank page." },
    { type: "codeBlock", props: { language: "text" }, content: "type / then Subpage" },
  ];
  const templateContent = [
    { type: "heading", props: { level: 2 }, content: "Meeting" },
    { type: "paragraph", content: "What we decided, and what happens next." },
    { type: "checkListItem", props: { checked: false }, content: "Decision" },
    { type: "checkListItem", props: { checked: false }, content: "Owner" },
  ];

  const sql = await getSql();
  const rows: Array<{
    id: string;
    parent: string | null;
    title: string;
    icon: string;
    cover: string;
    favorite: boolean;
    position: number;
    status: string;
    template: boolean;
    content: unknown[];
    properties: PageProperty[];
  }> = [
    {
      id: welcome,
      parent: null,
      title: "Welcome to Motion",
      icon: "compass",
      cover: "wash",
      favorite: true,
      position: 0,
      status: "live",
      template: false,
      content: welcomeContent,
      properties: welcomeProps,
    },
    {
      id: notes,
      parent: welcome,
      title: "Field notes",
      icon: "pen-line",
      cover: "none",
      favorite: false,
      position: 0,
      status: "draft",
      template: false,
      content: notesContent,
      properties: [],
    },
    {
      id: studio,
      parent: null,
      title: "The studio",
      icon: "layers",
      cover: "none",
      favorite: false,
      position: 1,
      status: "draft",
      template: false,
      content: studioContent,
      properties: [],
    },
    {
      id: template,
      parent: null,
      title: "Meeting template",
      icon: "flag",
      cover: "none",
      favorite: false,
      position: 0,
      status: "draft",
      template: true,
      content: templateContent,
      properties: [],
    },
  ];

  for (const row of rows) {
    const search = searchPlain(row.title, row.content, row.properties);
    await sql`
      insert into pages (
        id, user_id, parent_id, title, icon, cover, favorite, position, status, is_template, content, properties, search_text
      )
      values (
        ${row.id},
        ${userId},
        ${row.parent},
        ${row.title},
        ${row.icon},
        ${row.cover},
        ${row.favorite},
        ${row.position},
        ${row.status},
        ${row.template},
        ${JSON.stringify(row.content)}::jsonb,
        ${JSON.stringify(row.properties)}::jsonb,
        ${search}
      )
    `;
  }
}

export async function readPageForAsk(userId: string, id: string) {
  if (!isId(id)) throw new Error("Unknown page");
  const sql = await getSql();
  const rows = await sql<{
    title: string;
    status: string;
    content: unknown;
    properties: unknown;
  }>`
    select title, status, content, properties from pages where user_id = ${userId} and id = ${id}
  `;
  const row = rows[0];
  if (!row) throw new Error("That page is gone");
  return {
    title: row.title,
    status: row.status,
    body: searchPlain("", row.content, []).slice(0, 4000),
    properties: asProperties(row.properties)
      .map((property) => `${property.name}: ${property.value}`)
      .join("\n")
      .slice(0, 800),
  };
}
