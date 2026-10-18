import { getSql } from "@/lib/db";
import {
  asBlocks,
  isCover,
  isIcon,
  isId,
  isStatus,
  type PageDetail,
  type PagePatch,
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
  updated_at: string;
};

type DetailRow = SummaryRow & { content: unknown };

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
    updatedAt: row.updated_at,
  };
}

const SUMMARY = `
  id, parent_id, title, icon, cover, favorite, position, status,
  to_char(updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
`;

export async function loadStudioData(pageId: string | null): Promise<StudioData> {
  const sql = await getSql();
  const rows = await sql.query<SummaryRow>(
    `select ${SUMMARY} from pages order by position asc, title asc`,
  );
  const pages = rows.map(toSummary);
  if (!pageId) return { pages, page: null };
  const detail = await sql.query<DetailRow>(
    `select ${SUMMARY}, content from pages where id = $1`,
    [pageId],
  );
  const row = detail[0];
  if (!row) return { pages, page: null };
  const page: PageDetail = {
    ...toSummary(row),
    content: JSON.stringify(asBlocks(row.content)),
  };
  return { pages, page };
}

async function nextPosition(parentId: string | null): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ next: number }>`
    select coalesce(max(position), 0) + 1 as next
    from pages
    where (${parentId}::text is null and parent_id is null) or parent_id = ${parentId}
  `;
  return Number(rows[0]?.next ?? 1);
}

async function assertParent(parentId: string | null) {
  if (!parentId) return;
  const sql = await getSql();
  const rows = await sql<{ id: string }>`select id from pages where id = ${parentId}`;
  if (!rows[0]) throw new Error("That parent page is gone");
}

export async function createPageRow(input: {
  title?: string;
  parentId?: string | null;
  icon?: string;
  status?: string;
}): Promise<{ id: string }> {
  const parentId = input.parentId ?? null;
  if (parentId && !isId(parentId)) throw new Error("Unknown page");
  await assertParent(parentId);
  const title = (input.title ?? "Untitled").trim().slice(0, 180) || "Untitled";
  const icon = input.icon && isIcon(input.icon) ? input.icon : "file-text";
  const status = input.status && isStatus(input.status) ? input.status : "draft";
  const id = crypto.randomUUID();
  const position = await nextPosition(parentId);
  const sql = await getSql();
  await sql`
    insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
    values (${id}, ${parentId}, ${title}, ${icon}, ${"none"}, false, ${position}, ${status}, ${"[]"}::jsonb)
  `;
  return { id };
}

async function parentChainCycles(id: string, parentId: string | null): Promise<boolean> {
  if (!parentId) return false;
  if (parentId === id) return true;
  const sql = await getSql();
  const seen = new Set<string>();
  let current: string | null = parentId;
  while (current) {
    if (current === id || seen.has(current)) return true;
    seen.add(current);
    const rows: { parent_id: string | null }[] = await sql<{ parent_id: string | null }>`
      select parent_id from pages where id = ${current}
    `;
    current = rows[0]?.parent_id ?? null;
  }
  return false;
}

export async function updatePageRow(id: string, patch: PagePatch): Promise<void> {
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
  if (patch.parentId !== undefined) {
    if (patch.parentId && !isId(patch.parentId)) throw new Error("Unknown page");
    if (await parentChainCycles(id, patch.parentId)) {
      throw new Error("A page can't sit inside itself");
    }
    if (patch.parentId) await assertParent(patch.parentId);
    push("parent_id", patch.parentId);
  }
  if (!sets.length) return;

  const contentIndex = patch.content !== undefined ? sets.findIndex((set) => set.startsWith("content")) : -1;
  if (contentIndex >= 0) sets[contentIndex] = sets[contentIndex] + "::jsonb";

  values.push(id);
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `update pages set ${sets.join(", ")}, updated_at = now() where id = $${values.length} returning id`,
    values,
  );
  if (!rows[0]) throw new Error("That page is gone");
}

export async function deletePageRow(id: string): Promise<{ parentId: string | null }> {
  if (!isId(id)) throw new Error("Unknown page");
  const sql = await getSql();
  const existing = await sql<{ parent_id: string | null }>`
    select parent_id from pages where id = ${id}
  `;
  if (!existing[0]) throw new Error("That page is gone");
  await sql`delete from pages where id = ${id}`;
  return { parentId: existing[0].parent_id };
}

export async function duplicatePageRow(id: string): Promise<{ id: string }> {
  if (!isId(id)) throw new Error("Unknown page");
  const sql = await getSql();
  const rows = await sql<{
    parent_id: string | null;
    title: string;
    icon: string;
    cover: string;
    status: string;
    content: unknown;
  }>`
    select parent_id, title, icon, cover, status, content from pages where id = ${id}
  `;
  const source = rows[0];
  if (!source) throw new Error("That page is gone");
  const copyId = crypto.randomUUID();
  const position = await nextPosition(source.parent_id);
  const title = `${source.title} copy`.slice(0, 180);
  await sql`
    insert into pages (id, parent_id, title, icon, cover, favorite, position, status, content)
    values (
      ${copyId},
      ${source.parent_id},
      ${title},
      ${source.icon},
      ${source.cover},
      false,
      ${position},
      ${source.status},
      ${JSON.stringify(asBlocks(source.content))}::jsonb
    )
  `;
  return { id: copyId };
}
