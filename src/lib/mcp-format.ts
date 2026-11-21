import { asBlocks, collectText, type PageDetail, type PageSummary } from "./pages.ts";

export function pageLine(page: Pick<PageSummary, "id" | "title" | "status" | "template" | "parentId">): string {
  return [page.id, page.template ? "template" : page.status, page.parentId ?? "-", page.title].join("\t");
}

export function matchingPages(pages: PageSummary[], query: string): PageSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return pages
    .filter((page) => `${page.title} ${page.searchText}`.toLowerCase().includes(needle))
    .slice(0, 30);
}

function blockLine(block: unknown): string | null {
  if (!block || typeof block !== "object") return null;
  const record = block as Record<string, unknown>;
  if (record.type === "subpage") {
    const props =
      record.props && typeof record.props === "object" ? (record.props as Record<string, unknown>) : {};
    const title = typeof props.title === "string" && props.title.trim() ? props.title.trim() : "Untitled";
    const id = typeof props.pageId === "string" ? props.pageId : "";
    return id ? `Subpage: ${title} (${id})` : `Subpage: ${title}`;
  }
  const words = collectText(record.content).join(" ").replace(/\s+/g, " ").trim();
  return words || null;
}

export function formatPage(page: PageDetail): string {
  const properties = page.properties.map((property) => `${property.name}: ${property.value}`);
  const body = asBlocks(page.content).map(blockLine).filter((line): line is string => Boolean(line));
  return [page.title, `status: ${page.status}`, ...properties, ...body].join("\n").slice(0, 12000);
}
