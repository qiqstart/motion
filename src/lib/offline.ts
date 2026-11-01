import { searchPlain, type PageDetail, type PagePatch, type PageSummary, type StudioData } from "./pages.ts";

const DB_NAME = "motion-offline";
const STORE = "kv";
const KEY = "snapshot";

export type PendingEntry = { patch: PagePatch; rev: number };

export type PendingMap = Record<string, PendingEntry>;

export type Snapshot = {
  savedAt: string;
  pages: PageSummary[];
  details: Record<string, PageDetail>;
  pending: PendingMap;
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
  if (!summary) return snapshot;
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
  const ids = new Set(incoming.pages.map((page) => page.id));
  const details: Record<string, PageDetail> = {};
  for (const [id, detail] of Object.entries(previous?.details ?? {})) {
    if (ids.has(id)) details[id] = detail;
  }
  if (incoming.page) details[incoming.page.id] = incoming.page;
  let snapshot: Snapshot = {
    savedAt: now,
    pages: incoming.pages,
    details,
    pending: previous?.pending ?? {},
  };
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
      request.onsuccess = () => resolve((request.result as Snapshot | undefined) ?? null);
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
