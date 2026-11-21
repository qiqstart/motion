import * as z from "zod";
import { formatPage, matchingPages, pageLine } from "./mcp-format.ts";
import { asBlocks, isId, isStatus, paragraphsFromText, type PageDetail, type PageSummary } from "./pages.ts";

export const MOTION_TOOL_NAMES = [
  "list_pages",
  "read_page",
  "search_pages",
  "create_page",
  "update_page",
  "delete_page",
] as const;

export type MotionToolName = (typeof MOTION_TOOL_NAMES)[number];

export type MotionToolApi = {
  list(userId: string): Promise<PageSummary[]>;
  read(userId: string, id: string): Promise<PageDetail | null>;
  create(
    userId: string,
    input: { title: string; parentId: string | null; content?: unknown[] },
  ): Promise<{ id: string; title: string }>;
  update(
    userId: string,
    id: string,
    patch: { title?: string; status?: string; content?: unknown[] },
  ): Promise<void>;
  delete(userId: string, id: string): Promise<{ parentId: string | null }>;
};

export type ToolResult = { text: string; isError: boolean };

const schemas = {
  list_pages: z.object({}),
  read_page: z.object({ id: z.string() }),
  search_pages: z.object({ query: z.string().min(1).max(200) }),
  create_page: z.object({
    title: z.string().min(1).max(180),
    parentId: z.string().nullable().optional(),
    text: z.string().max(20000).optional(),
  }),
  update_page: z.object({
    id: z.string(),
    title: z.string().max(180).optional(),
    status: z.enum(["idea", "draft", "live"]).optional(),
    text: z.string().max(20000).optional(),
    mode: z.enum(["append", "replace"]).optional(),
  }),
  delete_page: z.object({ id: z.string() }),
} satisfies Record<MotionToolName, z.ZodType>;

export const MOTION_TOOL_DESCRIPTIONS: Record<MotionToolName, string> = {
  list_pages: "List pages in the signed-in Motion studio. One page per line: id, status, parent id, title.",
  read_page: "Read one Motion page as plain text, including properties and subpages.",
  search_pages: "Find pages whose title or text contains the query.",
  create_page: "Create a page in the signed-in studio. Text is split into paragraphs on blank lines.",
  update_page: "Change a page title, status, or text. Text appends unless mode is replace.",
  delete_page: "Delete a page and the pages nested under it.",
};

export function motionToolSchema(name: MotionToolName): z.ZodType {
  return schemas[name];
}

function fail(text: string): ToolResult {
  return { text, isError: true };
}

export async function runMotionTool(
  userId: string,
  name: string,
  args: unknown,
  api: MotionToolApi,
): Promise<ToolResult> {
  if (!userId) return fail("Unauthorized");
  if (!MOTION_TOOL_NAMES.includes(name as MotionToolName)) return fail("Unknown tool");
  const tool = name as MotionToolName;
  const parsed = schemas[tool].safeParse(args ?? {});
  if (!parsed.success) return fail("Invalid request");

  try {
    if (tool === "list_pages") {
      const pages = await api.list(userId);
      const lines = pages.slice(0, 200).map(pageLine);
      const extra = pages.length - lines.length;
      if (extra > 0) lines.push(`…${extra} more`);
      return { text: lines.join("\n") || "No pages", isError: false };
    }
    if (tool === "read_page") {
      const { id } = parsed.data as { id: string };
      if (!isId(id)) return fail("Unknown page");
      const page = await api.read(userId, id);
      if (!page) return fail("That page is gone");
      return { text: formatPage(page), isError: false };
    }
    if (tool === "search_pages") {
      const { query } = parsed.data as { query: string };
      const pages = await api.list(userId);
      return { text: matchingPages(pages, query).map(pageLine).join("\n") || "No matches", isError: false };
    }
    if (tool === "create_page") {
      const { title, parentId, text } = parsed.data as { title: string; parentId?: string | null; text?: string };
      if (parentId && !isId(parentId)) return fail("Unknown page");
      const created = await api.create(userId, {
        title,
        parentId: parentId ?? null,
        content: text?.trim() ? paragraphsFromText(text) : undefined,
      });
      return { text: `${created.id}\t${created.title}`, isError: false };
    }
    if (tool === "update_page") {
      const { id, title, status, text, mode } = parsed.data as {
        id: string;
        title?: string;
        status?: "idea" | "draft" | "live";
        text?: string;
        mode?: "append" | "replace";
      };
      if (!isId(id)) return fail("Unknown page");
      const patch: { title?: string; status?: string; content?: unknown[] } = {};
      if (title !== undefined) patch.title = title.replace(/\s+/g, " ").trim().slice(0, 180) || "Untitled";
      if (status !== undefined) {
        if (!isStatus(status)) return fail("Unknown status");
        patch.status = status;
      }
      if (text !== undefined && (mode === "replace" || text.trim())) {
        const blocks = paragraphsFromText(text);
        if (mode === "replace") patch.content = blocks;
        else {
          const current = await api.read(userId, id);
          if (!current) return fail("That page is gone");
          patch.content = [...asBlocks(current.content), ...blocks];
        }
      }
      if (!patch.title && !patch.status && !patch.content) return fail("Nothing to change");
      await api.update(userId, id, patch);
      return { text: `Updated ${id}`, isError: false };
    }
    const { id } = parsed.data as { id: string };
    if (!isId(id)) return fail("Unknown page");
    const result = await api.delete(userId, id);
    return { text: `Deleted ${id}${result.parentId ? `\nparent ${result.parentId}` : ""}`, isError: false };
  } catch (caught) {
    return fail(caught instanceof Error ? caught.message : "Something went wrong");
  }
}
