import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { matchingPages, pageLine } from "@/lib/mcp-format";
import { asBlocks, isId, isStatus, paragraphsFromText } from "@/lib/pages";
import { createPageRow, deletePageRow, loadStudioData, updatePageRow } from "@/lib/pages.server";

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

export function motionServer(userId: string): McpServer {
  const server = new McpServer({ name: "motion", version: "1.0.0" });

  server.registerTool(
    "list_pages",
    {
      description: "List pages in the signed-in Motion studio. One page per line: id, status, parent id, title.",
      inputSchema: z.object({}),
    },
    async () => {
      const studio = await loadStudioData(userId, null);
      const lines = studio.pages.slice(0, 200).map(pageLine);
      const extra = studio.pages.length - lines.length;
      if (extra > 0) lines.push(`…${extra} more`);
      return text(lines.join("\n") || "No pages");
    },
  );

  server.registerTool(
    "read_page",
    {
      description: "Read one Motion page as plain text, including its properties.",
      inputSchema: z.object({ id: z.string().describe("Page id from list_pages") }),
    },
    async ({ id }) => {
      if (!isId(id)) throw new Error("Unknown page");
      const studio = await loadStudioData(userId, id);
      const page = studio.page;
      if (!page) throw new Error("That page is gone");
      const body = asBlocks(page.content)
        .flatMap((block) => {
          if (!block || typeof block !== "object") return [];
          const record = block as { type?: string; content?: unknown };
          return [`${record.type ?? "block"}: ${JSON.stringify(record.content ?? "").slice(0, 2000)}`];
        })
        .join("\n");
      const properties = page.properties.map((property) => `${property.name}: ${property.value}`).join("\n");
      return text([page.title, `status: ${page.status}`, properties, body].filter(Boolean).join("\n\n").slice(0, 12000));
    },
  );

  server.registerTool(
    "search_pages",
    {
      description: "Find pages whose title or text contains the query.",
      inputSchema: z.object({ query: z.string().min(1).max(200) }),
    },
    async ({ query }) => {
      const studio = await loadStudioData(userId, null);
      return text(matchingPages(studio.pages, query).map(pageLine).join("\n") || "No matches");
    },
  );

  server.registerTool(
    "create_page",
    {
      description: "Create a page in the signed-in studio. Text is split into paragraphs on blank lines.",
      inputSchema: z.object({
        title: z.string().min(1).max(180),
        parentId: z.string().nullable().optional(),
        text: z.string().max(20000).optional(),
      }),
    },
    async ({ title, parentId, text: body }) => {
      if (parentId && !isId(parentId)) throw new Error("Unknown page");
      const created = await createPageRow(userId, { title, parentId: parentId ?? null });
      if (body?.trim()) await updatePageRow(userId, created.id, { content: paragraphsFromText(body) });
      return text(`${created.id}\t${created.title}`);
    },
  );

  server.registerTool(
    "update_page",
    {
      description: "Change a page title, status, or text. Text appends unless mode is replace.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().max(180).optional(),
        status: z.enum(["idea", "draft", "live"]).optional(),
        text: z.string().max(20000).optional(),
        mode: z.enum(["append", "replace"]).optional(),
      }),
    },
    async ({ id, title, status, text: body, mode }) => {
      if (!isId(id)) throw new Error("Unknown page");
      const patch: { title?: string; status?: string; content?: unknown[] } = {};
      if (title !== undefined) patch.title = title.replace(/\s+/g, " ").trim().slice(0, 180) || "Untitled";
      if (status !== undefined) {
        if (!isStatus(status)) throw new Error("Unknown status");
        patch.status = status;
      }
      if (body !== undefined) {
        const blocks = paragraphsFromText(body);
        if (mode === "replace") patch.content = blocks;
        else {
          const current = await loadStudioData(userId, id);
          if (!current.page) throw new Error("That page is gone");
          patch.content = [...asBlocks(current.page.content), ...blocks];
        }
      }
      if (!patch.title && !patch.status && !patch.content) throw new Error("Nothing to change");
      await updatePageRow(userId, id, patch);
      return text(`Updated ${id}`);
    },
  );

  server.registerTool(
    "delete_page",
    {
      description: "Delete a page and the pages nested under it.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      if (!isId(id)) throw new Error("Unknown page");
      const result = await deletePageRow(userId, id);
      return text(`Deleted ${id}${result.parentId ? `\nparent ${result.parentId}` : ""}`);
    },
  );

  return server;
}
