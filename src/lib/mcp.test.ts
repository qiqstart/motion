import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentConfig, bearerToken, decideCaller } from "./mcp-auth.ts";
import { formatPage, matchingPages, pageLine } from "./mcp-format.ts";
import { MOTION_TOOL_NAMES, runMotionTool, type MotionToolApi } from "./mcp-tools.ts";
import type { PageDetail, PageSummary } from "./pages.ts";

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
    searchText: "Field notes water",
    updatedAt: "2026-11-21T00:00:00.000Z",
    content: JSON.stringify([
      { type: "paragraph", content: "Bring water" },
      { type: "subpage", props: { pageId: "page-2", title: "Pack list" } },
    ]),
    properties: [{ id: "place", name: "Place", value: "Desk" }],
    backlinks: [],
    ...overrides,
  };
}

function summary(page: PageDetail): PageSummary {
  const { content: _content, properties: _properties, backlinks: _backlinks, ...rest } = page;
  return rest;
}

function fake(seed = [detail()]) {
  const pages = seed.map((page) => ({ ...page }));
  const calls: string[] = [];
  const api: MotionToolApi = {
    async list(userId) {
      calls.push(`list:${userId}`);
      return pages.map(summary);
    },
    async read(userId, id) {
      calls.push(`read:${userId}:${id}`);
      return pages.find((page) => page.id === id) ?? null;
    },
    async create(userId, input) {
      calls.push(`create:${userId}`);
      const page = detail({
        id: "page-new",
        title: input.title,
        parentId: input.parentId,
        content: JSON.stringify(input.content ?? []),
        properties: [],
        searchText: input.title,
      });
      pages.push(page);
      return { id: page.id, title: page.title };
    },
    async update(userId, id, patch) {
      calls.push(`update:${userId}:${id}`);
      const page = pages.find((item) => item.id === id);
      if (!page) throw new Error("That page is gone");
      if (patch.title) page.title = patch.title;
      if (patch.status) page.status = patch.status;
      if (patch.content) page.content = JSON.stringify(patch.content);
    },
    async delete(userId, id) {
      calls.push(`delete:${userId}:${id}`);
      const page = pages.find((item) => item.id === id);
      if (!page) throw new Error("That page is gone");
      pages.splice(pages.indexOf(page), 1);
      return { parentId: page.parentId };
    },
  };
  return { api, pages, calls };
}

describe("mcp session", () => {
  it("refuses a real database when auth is off and reads a bearer token", () => {
    assert.equal(
      decideCaller({ authConfigured: false, databaseConfigured: true, sessionUserId: null, devUserId: "dev-user" }),
      null,
    );
    assert.equal(
      decideCaller({ authConfigured: true, databaseConfigured: true, sessionUserId: "user-1", devUserId: "dev-user" }),
      "user-1",
    );
    assert.equal(bearerToken("Bearer motion-token"), "motion-token");
    assert.equal(bearerToken(null), "session");
    const config = agentConfig("https://motion.example", "/api/mcp", "motion-token");
    assert.equal(config.mcpServers.motion.url, "https://motion.example/api/mcp");
    assert.equal(config.mcpServers.motion.headers.Authorization, "Bearer motion-token");
  });
});

describe("mcp tools", () => {
  it("lists the tools and reads plain text for one user", async () => {
    assert.deepEqual(MOTION_TOOL_NAMES, [
      "list_pages",
      "read_page",
      "search_pages",
      "create_page",
      "update_page",
      "delete_page",
    ]);
    const studio = fake();
    const listed = await runMotionTool("user-1", "list_pages", {}, studio.api);
    assert.equal(listed.isError, false);
    assert.equal(listed.text, pageLine(summary(detail())));
    const read = await runMotionTool("user-1", "read_page", { id: "page-1" }, studio.api);
    assert.equal(read.isError, false);
    assert.equal(read.text, formatPage(detail()));
    assert.match(read.text, /Bring water/);
    assert.match(read.text, /Subpage: Pack list \(page-2\)/);
    assert.doesNotMatch(read.text, /\{"type"/);
    const found = await runMotionTool("user-1", "search_pages", { query: "water" }, studio.api);
    assert.match(found.text, /page-1/);
    assert.deepEqual(studio.calls, ["list:user-1", "read:user-1:page-1", "list:user-1"]);
  });

  it("creates, appends, replaces, and deletes without touching another user", async () => {
    const studio = fake();
    const created = await runMotionTool("user-1", "create_page", { title: "Route", text: "First" }, studio.api);
    assert.equal(created.text, "page-new\tRoute");
    const appended = await runMotionTool(
      "user-1",
      "update_page",
      { id: "page-1", text: "More water" },
      studio.api,
    );
    assert.equal(appended.isError, false);
    assert.match(studio.pages[0]?.content ?? "", /Bring water/);
    assert.match(studio.pages[0]?.content ?? "", /More water/);
    await runMotionTool("user-1", "update_page", { id: "page-1", text: "Only this", mode: "replace" }, studio.api);
    assert.doesNotMatch(studio.pages[0]?.content ?? "", /Bring water/);
    assert.match(studio.pages[0]?.content ?? "", /Only this/);
    const removed = await runMotionTool("user-1", "delete_page", { id: "page-new" }, studio.api);
    assert.match(removed.text, /Deleted page-new/);
    assert.equal(studio.pages.some((page) => page.id === "page-new"), false);
    assert.ok(studio.calls.every((call) => call.includes("user-1")));
  });

  it("rejects a bad id without a studio call, and a missing page as a tool error", async () => {
    const studio = fake();
    const bad = await runMotionTool("user-1", "read_page", { id: "no spaces" }, studio.api);
    const missing = await runMotionTool("user-1", "delete_page", { id: "missing" }, studio.api);
    const signedOut = await runMotionTool("", "list_pages", {}, studio.api);
    assert.equal(bad.isError, true);
    assert.equal(missing.isError, true);
    assert.equal(signedOut.isError, true);
    assert.deepEqual(studio.calls, ["delete:user-1:missing"]);
    assert.equal(matchingPages([summary(detail())], "   ").length, 0);
  });
});
