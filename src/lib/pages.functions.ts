import { createServerFn } from "@tanstack/react-start";
import {
  createPageRow,
  deletePageRow,
  duplicatePageRow,
  loadStudioData,
  updatePageRow,
} from "@/lib/pages.server";
import {
  isCover,
  isIcon,
  isId,
  isStatus,
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
  .validator((data: { pageId?: string | null }) => {
    const pageId = data?.pageId ?? null;
    if (pageId === null || pageId === "") return { pageId: null as string | null };
    if (typeof pageId !== "string" || !isId(pageId)) throw new Error("Unknown page");
    return { pageId };
  })
  .handler(async ({ data }) => loadStudioData(data.pageId));

export const createPage = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => createPageRow(data));

export const updatePage = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    await updatePageRow(id, patch);
    return { ok: true as const };
  });

export const deletePage = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => {
    if (!data || typeof data.id !== "string" || !isId(data.id)) throw new Error("Unknown page");
    return { id: data.id };
  })
  .handler(async ({ data }) => deletePageRow(data.id));

export const duplicatePage = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => {
    if (!data || typeof data.id !== "string" || !isId(data.id)) throw new Error("Unknown page");
    return { id: data.id };
  })
  .handler(async ({ data }) => duplicatePageRow(data.id));
