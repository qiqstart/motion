export const ICONS = [
  "file-text",
  "book-open",
  "compass",
  "layers",
  "pen-line",
  "flag",
  "zap",
  "star",
  "box",
  "map",
  "leaf",
  "flame",
  "cuboid",
  "clapperboard",
] as const;

export const COVERS = ["none", "wash", "ink", "copper"] as const;
export const STATUSES = ["idea", "draft", "live"] as const;

export type IconName = (typeof ICONS)[number];
export type CoverName = (typeof COVERS)[number];
export type StatusName = (typeof STATUSES)[number];

export type PageProperty = {
  id: string;
  name: string;
  value: string;
};

export type Backlink = {
  id: string;
  title: string;
  icon: string;
};

export type PageSummary = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  cover: string;
  favorite: boolean;
  position: number;
  status: string;
  template: boolean;
  searchText: string;
  updatedAt: string;
};

export type PageDetail = PageSummary & {
  content: string;
  properties: PageProperty[];
  backlinks: Backlink[];
};

export type StudioData = {
  pages: PageSummary[];
  page: PageDetail | null;
};

export type PagePatch = {
  title?: string;
  icon?: string;
  cover?: string;
  favorite?: boolean;
  status?: string;
  content?: unknown[];
  properties?: PageProperty[];
  parentId?: string | null;
};

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function isId(value: string): boolean {
  return ID_RE.test(value);
}

export function isIcon(value: string): value is IconName {
  return (ICONS as readonly string[]).includes(value);
}

export function isCover(value: string): value is CoverName {
  return (COVERS as readonly string[]).includes(value);
}

export function isStatus(value: string): value is StatusName {
  return (STATUSES as readonly string[]).includes(value);
}

export function asBlocks(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asProperties(value: unknown): PageProperty[] {
  const source = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(source)) return [];
  const out: PageProperty[] = [];
  for (const item of source) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") continue;
    const name = record.name.trim().slice(0, 40);
    if (!name) continue;
    const id = typeof record.id === "string" && isId(record.id) ? record.id : "property";
    const propertyValue = typeof record.value === "string" ? record.value.slice(0, 240) : "";
    out.push({ id, name, value: propertyValue });
    if (out.length === 16) break;
  }
  return out;
}

export function normalizeProperties(value: unknown): PageProperty[] {
  if (!Array.isArray(value)) throw new Error("Properties need to be a list");
  const out: PageProperty[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid property");
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") throw new Error("Invalid property");
    const name = record.name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) continue;
    const id = typeof record.id === "string" && isId(record.id) ? record.id : crypto.randomUUID();
    const propertyValue =
      typeof record.value === "string" ? record.value.replace(/\s+/g, " ").trim().slice(0, 240) : "";
    out.push({ id, name, value: propertyValue });
    if (out.length === 16) break;
  }
  return out;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function collectText(value: unknown): string[] {
  const texts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      texts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.text === "string") texts.push(record.text);
    if (typeof record.title === "string") texts.push(record.title);
    if ("content" in record) walk(record.content);
    if ("children" in record) walk(record.children);
    if ("rows" in record) walk(record.rows);
  };
  walk(value);
  return texts;
}

export function countWords(value: unknown): number {
  const joined = collectText(asBlocks(value)).join(" ").trim();
  if (!joined) return 0;
  return joined.split(/\s+/).length;
}

export function searchPlain(title: string, content: unknown, properties: PageProperty[]): string {
  const parts = [title, ...collectText(asBlocks(content))];
  for (const property of properties) parts.push(property.name, property.value);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 8000);
}

export function paragraphsFromText(text: string): unknown[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((part) => ({ type: "paragraph", content: part.slice(0, 2000) }));
}

export function formatEdited(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ancestors(pages: PageSummary[], parentId: string | null): PageSummary[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const trail: PageSummary[] = [];
  const seen = new Set<string>();
  let current = parentId ? byId.get(parentId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail.reverse();
}

export function isDescendant(pages: PageSummary[], ancestorId: string, maybeChildId: string): boolean {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const seen = new Set<string>();
  let current = byId.get(maybeChildId);
  while (current && !seen.has(current.id)) {
    if (current.id === ancestorId) return true;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

export function statusLabel(status: string): string {
  if (status === "idea") return "Idea";
  if (status === "live") return "Live";
  return "Draft";
}
