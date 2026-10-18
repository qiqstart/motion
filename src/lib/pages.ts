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

export type PageSummary = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  cover: string;
  favorite: boolean;
  position: number;
  status: string;
  updatedAt: string;
};

export type PageDetail = PageSummary & {
  content: string;
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

export function countWords(value: unknown): number {
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
    if ("content" in record) walk(record.content);
    if ("children" in record) walk(record.children);
    if ("rows" in record) walk(record.rows);
  };
  walk(asBlocks(value));
  const joined = texts.join(" ").trim();
  if (!joined) return 0;
  return joined.split(/\s+/).length;
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

export function statusLabel(status: string): string {
  if (status === "idea") return "Idea";
  if (status === "live") return "Live";
  return "Draft";
}
