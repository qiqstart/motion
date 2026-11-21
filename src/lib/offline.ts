import {
  asBlocks,
  isDescendant,
  isIcon,
  isStatus,
  searchPlain,
  type PageDetail,
  type PagePatch,
  type PageProperty,
  type PageSummary,
  type StudioData,
} from "./pages.ts";

const DB_NAME = "motion-offline";
const STORE = "kv";
const KEY = "snapshot";

export type PendingEntry = { patch: PagePatch; rev: number };

export type PendingMap = Record<string, PendingEntry>;

export type TreeOp =
  | {
      kind: "create";
      rev: number;
      id: string;
      parentId: string | null;
      title: string;
      icon: string;
      cover: string;
      status: string;
      template: boolean;
      favorite: boolean;
      content: string;
      properties: PageProperty[];
    }
  | { kind: "delete"; rev: number; id: string }
  | { kind: "move"; rev: number; id: string; parentId: string | null; index: number };

export type Snapshot = {
  savedAt: string;
  pages: PageSummary[];
  details: Record<string, PageDetail>;
  pending: PendingMap;
  ops: TreeOp[];
};

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("offline")
  );
}

export function mergePatch(current: PagePatch | undefined, next: PagePatch): PagePatch {
  return { ...current, ...next };
}

export function applyDetail(detail: PageDetail, patch: PagePatch, now = new Date().toISOString()): PageDetail {
  const content = patch.content !== undefined ? JSON.stringify(patch.content) : detail.content;
  const properties = patch.properties ?? detail.properties;
  const next: PageDetail = {
    ...detail,
    title: patch.title ?? detail.title,
    icon: patch.icon ?? detail.icon,
    cover: patch.cover ?? detail.cover,
    favorite: patch.favorite ?? detail.favorite,
    status: patch.status ?? detail.status,
    content,
    properties,
    updatedAt: now,
  };
  next.searchText = searchPlain(next.title, next.content, next.properties).slice(0, 2000);
  return next;
}

function blankDetail(summary: PageSummary): PageDetail {
  return { ...summary, content: "[]", properties: [], backlinks: [] };
}

export function withPatch(snapshot: Snapshot, id: string, patch: PagePatch, record: boolean, now?: string): Snapshot {
  const summary = snapshot.pages.find((page) => page.id === id);
  if (!summary) {
    if (!record) return snapshot;
    return {
      ...snapshot,
      ops: snapshot.ops ?? [],
      pending: {
        ...snapshot.pending,
        [id]: { patch: mergePatch(snapshot.pending[id]?.patch, patch), rev: (snapshot.pending[id]?.rev ?? 0) + 1 },
      },
    };
  }
  const detail = applyDetail(snapshot.details[id] ?? blankDetail(summary), patch, now);
  return {
    ...snapshot,
    savedAt: detail.updatedAt,
    pages: snapshot.pages.map((page) => (page.id === id ? toSummary(detail) : page)),
    details: { ...snapshot.details, [id]: detail },
    pending: record
      ? {
          ...snapshot.pending,
          [id]: {
            patch: mergePatch(snapshot.pending[id]?.patch, patch),
            rev: (snapshot.pending[id]?.rev ?? 0) + 1,
          },
        }
      : snapshot.pending,
    ops: snapshot.ops ?? [],
  };
}

function toSummary(detail: PageDetail): PageSummary {
  return {
    id: detail.id,
    parentId: detail.parentId,
    title: detail.title,
    icon: detail.icon,
    cover: detail.cover,
    favorite: detail.favorite,
    position: detail.position,
    status: detail.status,
    template: detail.template,
    searchText: detail.searchText,
    updatedAt: detail.updatedAt,
  };
}

export function remember(previous: Snapshot | null, incoming: StudioData, now = new Date().toISOString()): Snapshot {
  const ops = previous?.ops ?? [];
  const keep = new Set(incoming.pages.map((page) => page.id));
  for (const op of ops) if (op.kind === "create") keep.add(op.id);
  const details: Record<string, PageDetail> = {};
  for (const [id, detail] of Object.entries(previous?.details ?? {})) {
    if (keep.has(id)) details[id] = detail;
  }
  if (incoming.page) details[incoming.page.id] = incoming.page;
  let snapshot: Snapshot = {
    savedAt: now,
    pages: incoming.pages,
    details,
    pending: previous?.pending ?? {},
    ops,
  };
  for (const op of ops) snapshot = replayOp(snapshot, op);
  for (const [id, entry] of Object.entries(snapshot.pending)) {
    snapshot = withPatch(snapshot, id, entry.patch, false, now);
  }
  return snapshot;
}

export function studioFromSnapshot(snapshot: Snapshot, pageId: string | null): StudioData {
  const id =
    pageId ?? snapshot.pages.find((page) => page.parentId === null && !page.template)?.id ?? null;
  if (!id) return { pages: snapshot.pages, page: null };
  const summary = snapshot.pages.find((page) => page.id === id);
  if (!summary) return { pages: snapshot.pages, page: null };
  return { pages: snapshot.pages, page: snapshot.details[id] ?? blankDetail(summary) };
}

export function applyPatchToStudio(studio: StudioData, id: string, patch: PagePatch, now?: string): StudioData {
  const snapshot = withPatch(remember(null, studio, now), id, patch, false, now);
  return {
    pages: snapshot.pages,
    page: studio.page?.id === id ? (snapshot.details[id] ?? studio.page) : studio.page,
  };
}

function descendantIds(pages: PageSummary[], id: string): Set<string> {
  const drop = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const page of pages) {
      if (page.parentId && drop.has(page.parentId) && !drop.has(page.id)) {
        drop.add(page.id);
        grew = true;
      }
    }
  }
  return drop;
}

function placePage(pages: PageSummary[], id: string, parentId: string | null, index: number): PageSummary[] {
  const moving = pages.find((page) => page.id === id);
  if (!moving) return pages;
  const next = pages.map((page) => (page.id === id ? { ...page, parentId } : page));
  const moved = next.find((page) => page.id === id);
  if (!moved) return pages;
  const siblings = next
    .filter((page) => page.id !== id && page.parentId === parentId && !page.template)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, moved);
  const positions = new Map(siblings.map((page, position) => [page.id, position]));
  return next.map((page) => (positions.has(page.id) ? { ...page, position: positions.get(page.id) ?? page.position } : page));
}

function replayOp(snapshot: Snapshot, op: TreeOp): Snapshot {
  if (op.kind === "create") {
    if (snapshot.pages.some((page) => page.id === op.id)) return snapshot;
    const detail = applyDetail(
      {
        id: op.id,
        parentId: op.parentId,
        title: op.title,
        icon: op.icon,
        cover: op.cover,
        favorite: op.favorite,
        position: 0,
        status: op.status,
        template: op.template,
        searchText: "",
        updatedAt: snapshot.savedAt,
        content: "[]",
        properties: [],
        backlinks: [],
      },
      {
        title: op.title,
        icon: op.icon,
        cover: op.cover,
        favorite: op.favorite,
        status: op.status,
        content: asBlocks(op.content),
        properties: op.properties,
      },
      snapshot.savedAt,
    );
    detail.parentId = op.parentId;
    detail.template = op.template;
    const siblings = snapshot.pages.filter((page) => page.parentId === op.parentId && !page.template);
    detail.position = siblings.reduce((max, page) => Math.max(max, page.position), -1) + 1;
    return {
      ...snapshot,
      pages: [...snapshot.pages, toSummary(detail)],
      details: { ...snapshot.details, [op.id]: detail },
    };
  }
  if (op.kind === "delete") {
    const drop = descendantIds(snapshot.pages, op.id);
    const pending = { ...snapshot.pending };
    for (const id of drop) delete pending[id];
    const details = { ...snapshot.details };
    for (const id of drop) delete details[id];
    return { ...snapshot, pages: snapshot.pages.filter((page) => !drop.has(page.id)), details, pending };
  }
  if (!snapshot.pages.some((page) => page.id === op.id)) return snapshot;
  if (op.parentId && isDescendant(snapshot.pages, op.id, op.parentId)) return snapshot;
  const pages = placePage(snapshot.pages, op.id, op.parentId, op.index);
  const moved = pages.find((page) => page.id === op.id);
  const detail = snapshot.details[op.id];
  return {
    ...snapshot,
    pages,
    details: detail && moved ? { ...snapshot.details, [op.id]: { ...detail, parentId: moved.parentId, position: moved.position } } : snapshot.details,
  };
}

function nextRev(snapshot: Snapshot): number {
  const pending = Object.values(snapshot.pending).reduce((max, entry) => Math.max(max, entry.rev), 0);
  return snapshot.ops.reduce((max, op) => Math.max(max, op.rev), pending) + 1;
}

function blankPage(id: string, parentId: string | null, now: string): PageDetail {
  return {
    id,
    parentId,
    title: "Untitled",
    icon: "file-text",
    cover: "none",
    favorite: false,
    position: 0,
    status: "draft",
    template: false,
    searchText: "",
    updatedAt: now,
    content: "[]",
    properties: [],
    backlinks: [],
  };
}

export function createLocal(
  snapshot: Snapshot,
  input: {
    id: string;
    parentId?: string | null;
    title?: string;
    icon?: string;
    cover?: string;
    status?: string;
    template?: boolean;
    favorite?: boolean;
    content?: unknown[];
    properties?: PageProperty[];
  },
  now = new Date().toISOString(),
): Snapshot {
  const title = (input.title ?? "Untitled").replace(/\s+/g, " ").trim().slice(0, 180) || "Untitled";
  const op: TreeOp = {
    kind: "create",
    rev: nextRev(snapshot),
    id: input.id,
    parentId: input.parentId ?? null,
    title,
    icon: input.icon && isIcon(input.icon) ? input.icon : "file-text",
    cover: input.cover ?? "none",
    status: input.status && isStatus(input.status) ? input.status : "draft",
    template: input.template === true,
    favorite: input.favorite === true,
    content: JSON.stringify(input.content ?? []),
    properties: input.properties ?? [],
  };
  const base = blankPage(op.id, op.parentId, now);
  base.template = op.template;
  const detail = applyDetail(
    base,
    {
      title: op.title,
      icon: op.icon,
      cover: op.cover,
      favorite: op.favorite,
      status: op.status,
      content: input.content ?? [],
      properties: op.properties,
    },
    now,
  );
  detail.parentId = op.parentId;
  detail.template = op.template;
  const siblings = snapshot.pages.filter((page) => page.parentId === op.parentId && !page.template);
  detail.position = siblings.reduce((max, page) => Math.max(max, page.position), -1) + 1;
  return {
    ...snapshot,
    savedAt: now,
    pages: [...snapshot.pages, toSummary(detail)],
    details: { ...snapshot.details, [detail.id]: detail },
    ops: [...snapshot.ops, op],
  };
}

export function deleteLocal(snapshot: Snapshot, id: string): { snapshot: Snapshot; parentId: string | null } {
  const page = snapshot.pages.find((item) => item.id === id);
  if (!page) return { snapshot, parentId: null };
  const drop = descendantIds(snapshot.pages, id);
  const local = new Set(snapshot.ops.filter((op) => op.kind === "create" && drop.has(op.id)).map((op) => op.id));
  let rev = nextRev(snapshot);
  const ops = snapshot.ops.filter((op) => {
    if ((op.kind === "create" || op.kind === "move") && drop.has(op.id)) return false;
    if (op.kind === "delete" && drop.has(op.id)) return false;
    return true;
  });
  for (const dropped of drop) {
    if (local.has(dropped)) continue;
    ops.push({ kind: "delete", rev, id: dropped });
    rev += 1;
  }
  const pending = { ...snapshot.pending };
  const details = { ...snapshot.details };
  for (const dropped of drop) {
    delete pending[dropped];
    delete details[dropped];
  }
  return {
    parentId: page.parentId,
    snapshot: {
      ...snapshot,
      pages: snapshot.pages.filter((item) => !drop.has(item.id)),
      details,
      pending,
      ops,
    },
  };
}

export function moveLocal(snapshot: Snapshot, id: string, parentId: string | null, index: number): Snapshot {
  const page = snapshot.pages.find((item) => item.id === id);
  if (!page || page.template) return snapshot;
  if (parentId && (parentId === id || isDescendant(snapshot.pages, id, parentId))) return snapshot;
  const pages = placePage(snapshot.pages, id, parentId, index);
  const moved = pages.find((item) => item.id === id);
  const detail = snapshot.details[id];
  const ops = snapshot.ops.map((op) => (op.kind === "create" && op.id === id ? { ...op, parentId } : op));
  ops.push({ kind: "move", rev: nextRev(snapshot), id, parentId, index });
  return {
    ...snapshot,
    pages,
    ops,
    details: detail && moved ? { ...snapshot.details, [id]: { ...detail, parentId: moved.parentId, position: moved.position } } : snapshot.details,
  };
}

export type SyncItem =
  | {
      kind: "create";
      rev: number;
      id: string;
      parentId: string | null;
      title: string;
      icon: string;
      status: string;
      template: boolean;
      patch: PagePatch | null;
    }
  | { kind: "move"; rev: number; id: string; parentId: string | null; index: number }
  | { kind: "delete"; rev: number; id: string }
  | { kind: "patch"; rev: number; id: string; patch: PagePatch };

function extraPatch(op: Extract<TreeOp, { kind: "create" }>): PagePatch | null {
  const patch: PagePatch = {};
  if (op.cover !== "none") patch.cover = op.cover;
  if (op.favorite) patch.favorite = true;
  const content = asBlocks(op.content);
  if (content.length) patch.content = content;
  if (op.properties.length) patch.properties = op.properties;
  return Object.keys(patch).length ? patch : null;
}

export function planSync(snapshot: Snapshot): SyncItem[] {
  const ops = snapshot.ops ?? [];
  const creates = ops.filter((op) => op.kind === "create");
  const ids = new Set(creates.map((op) => op.id));
  const ordered: Extract<TreeOp, { kind: "create" }>[] = [];
  const placed = new Set<string>();
  while (ordered.length < creates.length) {
    const next = creates.find(
      (op) => op.kind === "create" && !placed.has(op.id) && !(op.parentId && ids.has(op.parentId) && !placed.has(op.parentId)),
    );
    if (!next || next.kind !== "create") break;
    ordered.push(next);
    placed.add(next.id);
  }
  for (const op of creates) {
    if (op.kind === "create" && !placed.has(op.id)) ordered.push(op);
  }
  const depth = (id: string) => {
    let count = 0;
    let current = snapshot.pages.find((page) => page.id === id);
    const seen = new Set<string>();
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id);
      count += 1;
      current = snapshot.pages.find((page) => page.id === current?.parentId);
    }
    return count;
  };
  const deletes = ops
    .filter((op) => op.kind === "delete")
    .sort((a, b) => depth(b.id) - depth(a.id));
  return [
    ...ordered.map((op) => ({
      kind: "create" as const,
      rev: op.rev,
      id: op.id,
      parentId: op.parentId,
      title: op.title,
      icon: op.icon,
      status: op.status,
      template: op.template,
      patch: extraPatch(op),
    })),
    ...ops.filter((op) => op.kind === "move"),
    ...deletes,
    ...Object.entries(snapshot.pending).map(([id, entry]) => ({
      kind: "patch" as const,
      rev: entry.rev,
      id,
      patch: entry.patch,
    })),
  ];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadSnapshot(): Promise<Snapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const raw = request.result as Snapshot | undefined;
        if (!raw) {
          resolve(null);
          return;
        }
        resolve({ ...raw, pending: raw.pending ?? {}, ops: raw.ops ?? [] });
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(snapshot, KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function rememberStudio(incoming: StudioData): Promise<void> {
  const previous = await loadSnapshot();
  await saveSnapshot(remember(previous, incoming));
}

export async function readStudio(pageId: string | null): Promise<StudioData | null> {
  const snapshot = await loadSnapshot();
  if (!snapshot || snapshot.pages.length === 0) return null;
  return studioFromSnapshot(snapshot, pageId);
}

export async function queuePatch(studio: StudioData, id: string, patch: PagePatch): Promise<void> {
  const previous = (await loadSnapshot()) ?? remember(null, studio);
  await saveSnapshot(withPatch(previous, id, patch, true));
}

export async function pendingPatches(): Promise<Array<{ id: string; patch: PagePatch; rev: number }>> {
  const snapshot = await loadSnapshot();
  if (!snapshot) return [];
  return Object.entries(snapshot.pending).map(([id, entry]) => ({ id, patch: entry.patch, rev: entry.rev }));
}

export async function dropPending(id: string, rev: number): Promise<void> {
  const snapshot = await loadSnapshot();
  if (!snapshot || snapshot.pending[id]?.rev !== rev) return;
  const pending = { ...snapshot.pending };
  delete pending[id];
  await saveSnapshot({ ...snapshot, pending });
}

async function editSnapshot(studio: StudioData, focusId: string | null, change: (snapshot: Snapshot) => Snapshot): Promise<StudioData> {
  const current = (await loadSnapshot()) ?? remember(null, studio);
  const next = change(current);
  await saveSnapshot(next);
  return studioFromSnapshot(next, focusId);
}

export async function mergedStudio(incoming: StudioData): Promise<StudioData | null> {
  const snapshot = await loadSnapshot();
  if (!snapshot || (snapshot.ops.length === 0 && Object.keys(snapshot.pending).length === 0)) return null;
  return studioFromSnapshot(remember(snapshot, incoming), incoming.page?.id ?? null);
}

export async function queueCreate(
  studio: StudioData,
  input: { parentId?: string | null; title?: string; content?: unknown[]; template?: boolean },
): Promise<{ studio: StudioData; id: string; title: string }> {
  const id = crypto.randomUUID();
  const title = (input.title ?? "Untitled").replace(/\s+/g, " ").trim().slice(0, 180) || "Untitled";
  const view = await editSnapshot(studio, id, (snapshot) => createLocal(snapshot, { ...input, id, title }));
  return { studio: view, id, title };
}

export async function queueDelete(studio: StudioData, id: string): Promise<{ studio: StudioData; parentId: string | null }> {
  let parentId: string | null = null;
  const view = await editSnapshot(studio, null, (snapshot) => {
    const result = deleteLocal(snapshot, id);
    parentId = result.parentId;
    return result.snapshot;
  });
  return { studio: view, parentId };
}

export async function queueMove(studio: StudioData, id: string, parentId: string | null, index: number): Promise<StudioData> {
  return editSnapshot(studio, studio.page?.id ?? null, (snapshot) => moveLocal(snapshot, id, parentId, index));
}

export async function queueCopy(
  studio: StudioData,
  sourceId: string,
  mode: "copy" | "template" | "from-template",
): Promise<{ studio: StudioData; id: string }> {
  const id = crypto.randomUUID();
  const view = await editSnapshot(studio, id, (snapshot) => {
    const summary = snapshot.pages.find((page) => page.id === sourceId) ?? studio.pages.find((page) => page.id === sourceId);
    const source = snapshot.details[sourceId] ?? (studio.page?.id === sourceId ? studio.page : null);
    if (!summary || !source) throw new Error("Open that page once online, then try again.");
    const template = mode === "template";
    const title =
      mode === "template"
        ? `${source.title} template`.slice(0, 180)
        : mode === "from-template"
          ? source.title.replace(/\s+template$/, "").slice(0, 180) || "Untitled"
          : `${source.title} copy`.slice(0, 180);
    return createLocal(snapshot, {
      id,
      parentId: template ? null : mode === "from-template" ? null : source.parentId,
      title,
      icon: source.icon,
      cover: source.cover,
      status: template || mode === "from-template" ? "draft" : source.status,
      template,
      content: asBlocks(source.content),
      properties: source.properties,
    });
  });
  return { studio: view, id };
}

export async function syncItems(): Promise<SyncItem[]> {
  const snapshot = await loadSnapshot();
  return snapshot ? planSync(snapshot) : [];
}

export async function dropOp(rev: number): Promise<void> {
  const snapshot = await loadSnapshot();
  if (!snapshot || !snapshot.ops.some((op) => op.rev === rev)) return;
  await saveSnapshot({ ...snapshot, ops: snapshot.ops.filter((op) => op.rev !== rev) });
}
