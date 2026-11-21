import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchingPages, pageLine } from "./mcp-format.ts";
import type { PageSummary } from "./pages.ts";

function page(overrides: Partial<PageSummary> = {}): PageSummary {
  return {
    id: "page-1",
    parentId: null,
    title: "Field notes",
    icon: "pen-line",
    cover: "none",
    favorite: false,
    position: 0,
    status: "draft",
    template: false,
    searchText: "Field notes water",
    updatedAt: "2026-11-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("mcp page text", () => {
  it("prints a stable line and finds text that is not the title", () => {
    assert.equal(pageLine(page()), "page-1\tdraft\t-\tField notes");
    const hits = matchingPages([page(), page({ id: "page-2", title: "Other", searchText: "map" })], "water");
    assert.deepEqual(hits.map((hit) => hit.id), ["page-1"]);
    assert.equal(matchingPages([page()], "   ").length, 0);
  });
});
