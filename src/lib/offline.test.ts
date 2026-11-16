import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDetail,
  applyPatchToStudio,
  isOfflineError,
  mergePatch,
  remember,
  studioFromSnapshot,
  type Snapshot,
} from "./offline.ts";
import type { PageDetail, StudioData } from "./pages.ts";

const NOW = "2026-11-01T05:00:00.000Z";

function detail(overrides: Partial<PageDetail> = {}): PageDetail {
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
    searchText: "Field notes",
    updatedAt: "2026-10-01T00:00:00.000Z",
    content: "[]",
    properties: [],
    backlinks: [],
    ...overrides,
  };
}

function studio(page = detail()): StudioData {
  return { pages: [page], page };
}

describe("offline snapshots", () => {
  it("treats a failed fetch as offline and an auth error as online", () => {
    assert.equal(isOfflineError(new TypeError("Failed to fetch")), true);
    assert.equal(isOfflineError(new Error("Unauthorized")), false);
  });

  it("keeps an offline title edit when a stale server copy is remembered", () => {
    const saved = remember(null, studio(), NOW);
    const edited: Snapshot = {
      ...saved,
      pending: { "page-1": { patch: { title: "Packed list" }, rev: 1 } },
      pages: [{ ...saved.pages[0], title: "Packed list" }],
      details: { "page-1": { ...saved.details["page-1"], title: "Packed list" } },
    };
    const next = remember(edited, studio(), NOW);
    assert.equal(next.pages[0]?.title, "Packed list");
    assert.equal(next.details["page-1"]?.title, "Packed list");
    assert.equal(next.pending["page-1"]?.patch.title, "Packed list");
  });

  it("merges patches and applies them to the open page", () => {
    const patch = mergePatch({ title: "Packed list" }, { content: [{ type: "paragraph", content: "Water" }] });
    const updated = applyDetail(detail(), patch, NOW);
    assert.equal(updated.title, "Packed list");
    assert.match(updated.content, /Water/);
    assert.match(updated.searchText, /Water/);
    const view = applyPatchToStudio(studio(), "page-1", { status: "live" }, NOW);
    assert.equal(view.page?.status, "live");
    assert.equal(view.pages[0]?.status, "live");
  });

  it("opens a cached page that was never loaded in full", () => {
    const snapshot = remember(null, { pages: [detail()], page: null }, NOW);
    const view = studioFromSnapshot(snapshot, "page-1");
    assert.equal(view.page?.title, "Field notes");
    assert.equal(view.page?.content, "[]");
  });
});
