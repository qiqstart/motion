import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Board } from "@/components/studio/board";
import { CommandMenu } from "@/components/studio/command-menu";
import { PageView } from "@/components/studio/page-view";
import { Sidebar } from "@/components/studio/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createFromTemplate, createPage, deletePage, duplicatePage, movePage, saveTemplate, updatePage } from "@/lib/pages.functions";
import { isDescendant, paragraphsFromText, type PagePatch, type StudioData } from "@/lib/pages";

export function Studio({ data, view }: { data: StudioData; view: "page" | "board" }) {
  const navigate = useNavigate();
  const router = useRouter();
  const isLoading = useRouterState({ select: (state) => state.isLoading });
  const [navOpen, setNavOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [data.page?.id, view]);

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

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
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
      const created = await createPage({ data: { parentId: parentId ?? null } });
      setNavOpen(false);
      await navigate({ to: "/", search: { page: created.id, view: "page" } });
    });
  }

  function relocate(id: string, targetId: string, place: "before" | "after" | "inside") {
    const documents = data.pages.filter((page) => !page.template);
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
      await movePage({ data: { id, parentId, index } });
      await router.invalidate();
    });
  }

  async function createInline() {
    if (!data.page) return { id: "", title: "Untitled" };
    const created = await createPage({ data: { parentId: data.page.id, title: "Untitled" } });
    await router.invalidate();
    return created;
  }

  async function draftSubpage(title: string, text: string) {
    if (!data.page) return;
    await run(async () => {
      const created = await createPage({ data: { parentId: data.page?.id ?? null, title } });
      const content = paragraphsFromText(text);
      if (content.length) await updatePage({ data: { id: created.id, content } });
      await navigate({ to: "/", search: { page: created.id, view: "page" } });
    });
  }

  async function patch(id: string, next: PagePatch, silent?: boolean) {
    await updatePage({ data: { id, ...next } });
    if (!silent) await router.invalidate();
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <Sidebar
        pages={data.pages}
        activeId={data.page?.id}
        view={view}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onCreate={() => makePage(null)}
        onMove={relocate}
        onUseTemplate={(id) => {
          void run(async () => {
            const created = await createFromTemplate({ data: { id, parentId: null } });
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
          {error ? (
            <p role="alert" className="border-b border-line bg-copper-soft px-4 py-3 text-sm text-ink">
              {error}
            </p>
          ) : null}
          {view === "board" ? (
            <Board
              pages={data.pages.filter((page) => !page.template)}
              busy={busy}
              onOpen={openPage}
              onStatus={(id, status) => {
                void run(async () => {
                  await patch(id, { status });
                });
              }}
            />
          ) : data.page ? (
            <PageView
              key={data.page.id}
              page={data.page}
              pages={data.pages}
              busy={busy}
              onPatch={(next, silent) => patch(data.page!.id, next, silent)}
              onCreateSubpage={() => makePage(data.page?.id)}
              onCreateInline={createInline}
              onOpenPage={openPage}
              onDuplicate={() => {
                const id = data.page?.id;
                if (!id) return;
                void run(async () => {
                  const copy = await duplicatePage({ data: { id } });
                  await navigate({ to: "/", search: { page: copy.id, view: "page" } });
                });
              }}
              onSaveTemplate={() => {
                const id = data.page?.id;
                if (!id) return;
                void run(async () => {
                  await saveTemplate({ data: { id } });
                  await router.invalidate();
                });
              }}
              onUseTemplate={() => {
                const id = data.page?.id;
                if (!id) return;
                void run(async () => {
                  const created = await createFromTemplate({ data: { id, parentId: null } });
                  await navigate({ to: "/", search: { page: created.id, view: "page" } });
                });
              }}
              onDraftSubpage={draftSubpage}
              onDelete={() => {
                const id = data.page?.id;
                if (!id) return;
                void run(async () => {
                  const result = await deletePage({ data: { id } });
                  const fallback =
                    result.parentId ??
                    data.pages.find((page) => page.id !== id && page.parentId === null)?.id;
                  if (fallback) await navigate({ to: "/", search: { page: fallback, view: "page" } });
                  else await navigate({ to: "/", search: { page: undefined, view: "page" } });
                });
              }}
            />
          ) : data.pages.length === 0 ? (
            <EmptyStudio onCreate={() => makePage(null)} busy={busy} />
          ) : (
            <Missing onCreate={() => makePage(null)} busy={busy} />
          )}
        </div>
      </div>
      <CommandMenu
        open={palette}
        pages={data.pages}
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
