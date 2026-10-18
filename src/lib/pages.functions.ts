import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  createFromTemplateRow,
  createPageRow,
  deletePageRow,
  duplicatePageRow,
  loadStudioData,
  movePageRow,
  saveTemplateRow,
  updatePageRow,
} from "@/lib/pages.server";
import {
  isCover,
  isIcon,
  isId,
  isStatus,
  normalizeProperties,
  type PagePatch,
} from "@/lib/pages";

const MAX_CONTENT = 350_000;

function readObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid request");
  }
  return data as Record<string, unknown>;
}

export const loadStudio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { pageId?: string | null }) => {
    const pageId = data?.pageId ?? null;
    if (pageId === null || pageId === "") return { pageId: null as string | null };
    if (typeof pageId !== "string" || !isId(pageId)) throw new Error("Unknown page");
    return { pageId };
  })
  .handler(async ({ data, context }) => loadStudioData(context.userId, data.pageId));

export const createPage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { title?: string; parentId?: string | null; icon?: string; status?: string }) => {
    const body = readObject(data);
    const parentId = body.parentId;
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
      throw new Error("Unknown page");
    }
    return {
      title: typeof body.title === "string" ? body.title : undefined,
      parentId: typeof parentId === "string" ? parentId : null,
      icon: typeof body.icon === "string" ? body.icon : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
    };
  })
  .handler(async ({ data, context }) => createPageRow(context.userId, data));

export const updatePage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string } & PagePatch) => {
    const body = readObject(data);
    if (typeof body.id !== "string" || !isId(body.id)) throw new Error("Unknown page");
    const patch: { id: string } & PagePatch = { id: body.id };
    if (body.title !== undefined) {
      if (typeof body.title !== "string") throw new Error("Title needs to be text");
      const title = body.title.replace(/\s+/g, " ").trim().slice(0, 180);
      patch.title = title.length ? title : "Untitled";
    }
    if (body.icon !== undefined) {
      if (typeof body.icon !== "string" || !isIcon(body.icon)) throw new Error("Unknown icon");
      patch.icon = body.icon;
    }
    if (body.cover !== undefined) {
      if (typeof body.cover !== "string" || !isCover(body.cover)) throw new Error("Unknown cover");
      patch.cover = body.cover;
    }
    if (body.favorite !== undefined) {
      if (typeof body.favorite !== "boolean") throw new Error("Invalid request");
      patch.favorite = body.favorite;
    }
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !isStatus(body.status)) throw new Error("Unknown status");
      patch.status = body.status;
    }
    if (body.parentId !== undefined) {
      if (body.parentId !== null && typeof body.parentId !== "string") throw new Error("Unknown page");
      patch.parentId = body.parentId;
    }
    if (body.properties !== undefined) patch.properties = normalizeProperties(body.properties);
    if (body.content !== undefined) {
      let encoded: string;
      try {
        encoded = JSON.stringify(body.content);
      } catch {
        throw new Error("Those blocks couldn't be saved");
      }
      if (encoded.length > MAX_CONTENT) throw new Error("This page is too large to save");
      const parsed = JSON.parse(encoded) as unknown;
      if (!Array.isArray(parsed) || parsed.length > 2000) {
        throw new Error("Those blocks couldn't be saved");
      }
      if (parsed.some((block) => !block || typeof block !== "object" || Array.isArray(block))) {
        throw new Error("Those blocks couldn't be saved");
      }
      patch.content = parsed;
    }
    return patch;
  })
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    await updatePageRow(context.userId, id, patch);
    return { ok: true as const };
  });

export const deletePage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => {
    if (!data || typeof data.id !== "string" || !isId(data.id)) throw new Error("Unknown page");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => deletePageRow(context.userId, data.id));

export const duplicatePage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => {
    if (!data || typeof data.id !== "string" || !isId(data.id)) throw new Error("Unknown page");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => duplicatePageRow(context.userId, data.id));

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => {
    if (!data || typeof data.id !== "string" || !isId(data.id)) throw new Error("Unknown page");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => saveTemplateRow(context.userId, data.id));

export const createFromTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; parentId?: string | null }) => {
    const body = readObject(data);
    if (typeof body.id !== "string" || !isId(body.id)) throw new Error("Unknown page");
    const parentId = body.parentId;
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
      throw new Error("Unknown page");
    }
    return { id: body.id, parentId: typeof parentId === "string" ? parentId : null };
  })
  .handler(async ({ data, context }) => createFromTemplateRow(context.userId, data.id, data.parentId));

export const movePage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; parentId: string | null; index: number }) => {
    const body = readObject(data);
    if (typeof body.id !== "string" || !isId(body.id)) throw new Error("Unknown page");
    if (body.parentId !== null && typeof body.parentId !== "string") throw new Error("Unknown page");
    if (typeof body.parentId === "string" && !isId(body.parentId)) throw new Error("Unknown page");
    if (typeof body.index !== "number" || !Number.isInteger(body.index) || body.index < 0 || body.index > 500) {
      throw new Error("Invalid request");
    }
    return { id: body.id, parentId: body.parentId as string | null, index: body.index };
  })
  .handler(async ({ data, context }) => {
    await movePageRow(context.userId, data);
    return { ok: true as const };
  });
