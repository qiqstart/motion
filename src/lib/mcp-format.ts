import type { PageSummary } from "./pages.ts";

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
