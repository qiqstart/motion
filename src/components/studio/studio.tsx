import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Board } from "@/components/studio/board";
import { CommandMenu } from "@/components/studio/command-menu";
import { PageView } from "@/components/studio/page-view";
import { Sidebar } from "@/components/studio/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  applyPatchToStudio,
  dropOp,
  dropPending,
  isOfflineError,
  mergedStudio,
  queueCopy,
  queueCreate,
  queueDelete,
  queueMove,
  queuePatch,
  rememberStudio,
  syncItems,
} from "@/lib/offline";
import { createFromTemplate, createPage, deletePage, duplicatePage, movePage, saveTemplate, updatePage } from "@/lib/pages.functions";
import { isDescendant, paragraphsFromText, type PagePatch, type StudioData } from "@/lib/pages";

export function Studio({ data, view }: { data: StudioData & { offline?: boolean }; view: "page" | "board" }) {
  const navigate = useNavigate();
  const router = useRouter();
  const isLoading = useRouterState({ select: (state) => state.isLoading });
  const [navOpen, setNavOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(Boolean(data.offline));
  const [overlay, setOverlay] = useState<StudioData | null>(null);
  const shown = overlay ?? data;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [shown.page?.id, view]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
      if (event.key === "\\") {
        event.preventDefault();
        setNavOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setOverlay(null);
  }, [data]);

  useEffect(() => {
    const sync = () => setOffline(Boolean(data.offline) || navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [data.offline]);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      if (data.offline) return;
      const merged = await mergedStudio({ pages: data.pages, page: data.page });
      if (stopped || !merged) return;
      setOverlay(merged);
    })();
    return () => {
      stopped = true;
    };
  }, [data]);

  useEffect(() => {
    if (data.offline) return;
    void rememberStudio({ pages: data.pages, page: data.page });
  }, [data]);

  useEffect(() => {
    let stopped = false;
    async function flush() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      try {
        let sent = false;
        for (let pass = 0; pass < 6; pass += 1) {
          const queued = await syncItems();
          if (stopped || queued.length === 0) break;
          for (const item of queued) {
            if (item.kind === "create") {
              await createPage({
                data: {
                  id: item.id,
                  parentId: item.parentId,
                  title: item.title,
                  icon: item.icon,
                  status: item.status,
                  template: item.template,
                },
              });
              if (item.patch) await updatePage({ data: { id: item.id, ...item.patch } });
              await dropOp(item.rev);
            } else if (item.kind === "move") {
              await movePage({ data: { id: item.id, parentId: item.parentId, index: item.index } });
              await dropOp(item.rev);
            } else if (item.kind === "delete") {
              try {
                await deletePage({ data: { id: item.id } });
              } catch (caught) {
                if (!(caught instanceof Error) || !caught.message.includes("gone")) throw caught;
              }
              await dropOp(item.rev);
            } else {
              await updatePage({ data: { id: item.id, ...item.patch } });
              await dropPending(item.id, item.rev);
            }
            sent = true;
          }
        }
        if (!stopped && sent && (await syncItems()).length === 0) await router.invalidate();
      } catch (caught) {
        if (!stopped && isOfflineError(caught)) setOffline(true);
      }
    }
    void flush();
    window.addEventListener("online", flush);
    return () => {
      stopped = true;
      window.removeEventListener("online", flush);
    };
  }, [router]);

  function offlineMessage() {
    setOffline(true);
    setError("You're offline.");
  }

  async function onlineOr<T>(task: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (caught) {
      if (!isOfflineError(caught)) throw caught;
      setOffline(true);
      setError(null);
      return fallback();
    }
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      if (isOfflineError(caught)) offlineMessage();
      else setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function openPage(id: string) {
    setNavOpen(false);
    void navigate({ to: "/", search: { page: id, view: "page" } });
  }

  function makePage(parentId?: string | null) {
    void run(async () => {
      const created = await onlineOr(
        () => createPage({ data: { parentId: parentId ?? null } }),
        async () => {
          const saved = await queueCreate(shown, { parentId: parentId ?? null, title: "Untitled" });
          setOverlay(saved.studio);
          return saved;
        },
      );
      setNavOpen(false);
      await navigate({ to: "/", search: { page: created.id, view: "page" } });
    });
  }

  function relocate(id: string, targetId: string, place: "before" | "after" | "inside") {
    const documents = shown.pages.filter((page) => !page.template);
    const target = documents.find((page) => page.id === targetId);
    if (!target || id === targetId || isDescendant(documents, id, targetId)) return;
    const parentId = place === "inside" ? target.id : target.parentId;
    const siblings = documents
      .filter((page) => page.parentId === parentId && page.id !== id)
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    const index =
      place === "inside"
        ? siblings.length
        : Math.max(0, siblings.findIndex((page) => page.id === target.id) + (place === "after" ? 1 : 0));
    void run(async () => {
      await onlineOr(
        async () => {
          await movePage({ data: { id, parentId, index } });
          await router.invalidate();
        },
        async () => {
          setOverlay(await queueMove(shown, id, parentId, index));
        },
      );
    });
  }

  async function createInline() {
    const parentId = shown.page?.id;
    if (!parentId) return { id: "", title: "Untitled" };
    try {
      const created = await onlineOr(
        async () => {
          const page = await createPage({ data: { parentId, title: "Untitled" } });
          await router.invalidate();
          return page;
        },
        async () => {
          const saved = await queueCreate(shown, { parentId: shown.page?.id ?? null, title: "Untitled" });
          setOverlay(saved.studio);
          return saved;
        },
      );
      return created;
    } catch (caught) {
      if (isOfflineError(caught)) offlineMessage();
      else setError(caught instanceof Error ? caught.message : "Something went wrong");
      return { id: "", title: "Untitled" };
    }
  }

  async function draftSubpage(title: string, text: string) {
    if (!shown.page) return;
    await run(async () => {
      const blocks = paragraphsFromText(text);
      let stored = false;
      const created = await onlineOr(
        () => createPage({ data: { parentId: shown.page?.id ?? null, title } }),
        async () => {
          stored = true;
          const saved = await queueCreate(shown, { parentId: shown.page?.id ?? null, title, content: blocks });
          setOverlay(saved.studio);
          return saved;
        },
      );
      if (!stored && blocks.length) await patch(created.id, { content: blocks });
      await navigate({ to: "/", search: { page: created.id, view: "page" } });
    });
  }

  async function patch(id: string, next: PagePatch, silent?: boolean) {
    try {
      await updatePage({ data: { id, ...next } });
      if (!silent) await router.invalidate();
    } catch (caught) {
      if (!isOfflineError(caught)) throw caught;
      setOffline(true);
      const base = overlay ?? data;
      setOverlay(applyPatchToStudio(base, id, next));
      await queuePatch(base, id, next);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <Sidebar
        pages={shown.pages}
        activeId={shown.page?.id}
        view={view}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onCreate={() => makePage(null)}
        onMove={relocate}
        onUseTemplate={(id) => {
          void run(async () => {
            const created = await onlineOr(
              () => createFromTemplate({ data: { id, parentId: null } }),
              async () => {
                const saved = await queueCopy(shown, id, "from-template");
                setOverlay(saved.studio);
                return saved;
              },
            );
            setNavOpen(false);
            await navigate({ to: "/", search: { page: created.id, view: "page" } });
          });
        }}
        busy={busy}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={cn("h-0.5 bg-copper transition-opacity duration-200", isLoading ? "opacity-100" : "opacity-0")} />
        <div className="flex h-14 items-center gap-2 border-b border-line px-3 lg:hidden">
          <Button size="icon" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <span className="font-medium tracking-tight">Motion</span>
          <button
            type="button"
            className="ml-auto h-11 px-2 text-sm text-muted"
            onClick={() => setPalette(true)}
          >
            Search
          </button>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          {offline ? (
            <p className="border-b border-line bg-copper-soft px-4 py-2 text-sm text-ink">
              Offline. Changes stay on this device and sync when you reconnect.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="border-b border-line bg-copper-soft px-4 py-3 text-sm text-ink">
              {error}
            </p>
          ) : null}
          {view === "board" ? (
            <Board
              pages={shown.pages.filter((page) => !page.template)}
              busy={busy}
              onOpen={openPage}
              onStatus={(id, status) => {
                void run(async () => {
                  await patch(id, { status });
                });
              }}
            />
          ) : shown.page ? (
            <PageView
              key={shown.page.id}
              page={shown.page}
              pages={shown.pages}
              busy={busy}
              onPatch={(next, silent) => patch(shown.page!.id, next, silent)}
              onCreateSubpage={() => makePage(shown.page?.id)}
              onCreateInline={createInline}
              onOpenPage={openPage}
              onDuplicate={() => {
                const id = shown.page?.id;
                if (!id) return;
                void run(async () => {
                  const copy = await onlineOr(
                    () => duplicatePage({ data: { id } }),
                    async () => {
                      const saved = await queueCopy(shown, id, "copy");
                      setOverlay(saved.studio);
                      return saved;
                    },
                  );
                  await navigate({ to: "/", search: { page: copy.id, view: "page" } });
                });
              }}
              onSaveTemplate={() => {
                const id = shown.page?.id;
                if (!id) return;
                void run(async () => {
                  await onlineOr(
                    async () => {
                      await saveTemplate({ data: { id } });
                      await router.invalidate();
                    },
                    async () => {
                      const saved = await queueCopy(shown, id, "template");
                      setOverlay(saved.studio);
                    },
                  );
                });
              }}
              onUseTemplate={() => {
                const id = shown.page?.id;
                if (!id) return;
                void run(async () => {
                  const created = await onlineOr(
                    () => createFromTemplate({ data: { id, parentId: null } }),
                    async () => {
                      const saved = await queueCopy(shown, id, "from-template");
                      setOverlay(saved.studio);
                      return saved;
                    },
                  );
                  await navigate({ to: "/", search: { page: created.id, view: "page" } });
                });
              }}
              onDraftSubpage={draftSubpage}
              onDelete={() => {
                const id = shown.page?.id;
                if (!id) return;
                void run(async () => {
                  const result = await onlineOr(
                    () => deletePage({ data: { id } }),
                    async () => {
                      const saved = await queueDelete(shown, id);
                      setOverlay(saved.studio);
                      return { parentId: saved.parentId };
                    },
                  );
                  const fallback =
                    result.parentId ?? shown.pages.find((page) => page.id !== id && page.parentId === null)?.id;
                  if (fallback) await navigate({ to: "/", search: { page: fallback, view: "page" } });
                  else await navigate({ to: "/", search: { page: undefined, view: "page" } });
                });
              }}
            />
          ) : shown.pages.length === 0 ? (
            <EmptyStudio onCreate={() => makePage(null)} busy={busy} />
          ) : (
            <Missing onCreate={() => makePage(null)} busy={busy} />
          )}
        </div>
      </div>
      <CommandMenu
        open={palette}
        pages={shown.pages}
        onOpenChange={setPalette}
        onOpenPage={openPage}
        onCreate={() => makePage(null)}
        onBoard={() => {
          void navigate({ to: "/", search: (prev) => ({ page: prev.page, view: "board" }) });
        }}
      />
    </div>
  );
}

function EmptyStudio({ onCreate, busy }: { onCreate: () => void; busy: boolean }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <h1 className="font-serif text-4xl text-balance sm:text-5xl">Start the first page</h1>
      <p className="mt-3 text-pretty leading-relaxed text-muted">
        A page can hold writing, lists, and code. It saves to the studio as you type.
      </p>
      <Button variant="primary" className="mt-6" onClick={onCreate} disabled={busy}>
        New page
      </Button>
    </div>
  );
}

function Missing({ onCreate, busy }: { onCreate: () => void; busy: boolean }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <h1 className="font-serif text-4xl text-balance">This page isn’t in the studio</h1>
      <p className="mt-3 text-pretty leading-relaxed text-muted">
        It may have been deleted. The rest of the pages are still in the sidebar.
      </p>
      <Button variant="primary" className="mt-6" onClick={onCreate} disabled={busy}>
        New page
      </Button>
    </div>
  );
}

export function StudioPending() {
  return (
    <div className="flex h-dvh bg-paper text-ink">
      <div className="hidden w-72 bg-walnut lg:block" />
      <div className="flex min-w-0 flex-1 flex-col px-6 pt-16 sm:px-8">
        <div className="h-10 w-64 rounded-md bg-paper-2" />
        <div className="mt-8 h-4 w-96 max-w-full rounded-sm bg-paper-2" />
        <div className="mt-3 h-4 w-80 max-w-full rounded-sm bg-paper-2" />
      </div>
    </div>
  );
}
