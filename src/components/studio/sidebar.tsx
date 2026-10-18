import { Link } from "@tanstack/react-router";
import { ChevronRight, GripVertical, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageIcon } from "@/components/studio/icons";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/cn";
import type { PageSummary } from "@/lib/pages";

const SOURCE_URL = "https://github.com/qiqstart/motion";
const PADS = ["pl-1", "pl-4", "pl-8", "pl-10", "pl-12"] as const;
type Place = "before" | "after" | "inside";

export function Sidebar({
  pages,
  activeId,
  view,
  open,
  onClose,
  onCreate,
  onMove,
  onUseTemplate,
  busy,
}: {
  pages: PageSummary[];
  activeId?: string;
  view: "page" | "board";
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onMove: (id: string, targetId: string, place: Place) => void;
  onUseTemplate: (id: string) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [wide, setWide] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; place: Place } | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const needle = query.trim().toLowerCase();
  const documents = pages.filter((page) => !page.template);
  const templates = pages.filter((page) => page.template);
  const favorites = documents.filter((page) => page.favorite);
  const matches = useMemo(() => {
    if (!needle) return [];
    return pages.flatMap((page) => {
      const title = page.title.toLowerCase().includes(needle);
      const body = page.searchText.toLowerCase().includes(needle);
      if (!title && !body) return [];
      return [{ page, inText: !title && body }];
    });
  }, [needle, pages]);
  const childrenOf = (parentId: string | null) =>
    documents
      .filter((page) => page.parentId === parentId)
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  function renderBranch(parentId: string | null, depth: number) {
    return childrenOf(parentId).map((page) => {
      const children = childrenOf(page.id);
      const isOpen = collapsed[page.id] !== true;
      const mark = over?.id === page.id ? over.place : null;
      return (
        <div key={page.id}>
          <div
            className={cn(
              "flex items-center rounded-md",
              PADS[Math.min(depth, PADS.length - 1)],
              mark === "inside" && "bg-walnut-2",
              mark === "before" && "border-t-2 border-copper",
              mark === "after" && "border-b-2 border-copper",
              dragId === page.id && "opacity-50",
            )}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("application/x-motion-page")) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientY - rect.top) / rect.height;
              const place: Place = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
              setOver({ id: page.id, place });
            }}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("application/x-motion-page");
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
              const place: Place = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
              if (id) onMove(id, page.id, place);
              setDragId(null);
              setOver(null);
            }}
          >
            <button
              type="button"
              draggable
              aria-label={`Move ${page.title}`}
              className="grid h-11 w-8 shrink-0 cursor-grab place-items-center text-walnut-muted active:cursor-grabbing"
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-motion-page", page.id);
                event.dataTransfer.effectAllowed = "move";
                setDragId(page.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOver(null);
              }}
            >
              <GripVertical className="size-4" />
            </button>
            {children.length ? (
              <button
                type="button"
                className="grid h-11 w-8 shrink-0 place-items-center text-walnut-muted"
                aria-expanded={isOpen}
                aria-label={isOpen ? `Collapse ${page.title}` : `Expand ${page.title}`}
                onClick={() => setCollapsed((state) => ({ ...state, [page.id]: isOpen }))}
              >
                <ChevronRight className={cn("size-4 transition-transform duration-200", isOpen && "rotate-90")} />
              </button>
            ) : (
              <span className="w-8 shrink-0" />
            )}
            <PageLink page={page} active={view === "page" && activeId === page.id} onNavigate={onClose} />
          </div>
          {children.length && isOpen ? renderBranch(page.id, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-walnut/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        inert={!wide && !open ? true : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-72 flex-col bg-walnut text-paper transition-transform duration-200 ease-out lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <Link to="/" search={{ page: undefined, view: "page" }} className="flex items-center gap-2.5" onClick={onClose}>
            <span className="inline-block h-3.5 w-4 -skew-x-12 rounded-sm bg-copper" aria-hidden="true" />
            <span className="text-lg font-medium tracking-tight">Motion</span>
          </Link>
          <Button variant="quiet" size="icon" className="lg:hidden" aria-label="Close menu" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="px-3">
          <label className="relative block">
            <span className="sr-only">Search pages</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-walnut-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages and text"
              className="h-11 w-full rounded-md border border-walnut-line bg-walnut-2 pr-3 pl-9 text-sm text-paper outline-none placeholder:text-walnut-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
            />
          </label>
          <Button variant="primary" className="mt-3 w-full" onClick={onCreate} disabled={busy}>
            <Plus className="size-4" />
            New page
          </Button>
        </div>

        <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Pages">
          {needle ? (
            <div className="px-1">
              <p className="px-2 pb-1 text-xs tracking-wide text-walnut-muted">Matches</p>
              {matches.length ? (
                matches.map(({ page, inText }) => (
                  <div key={page.id}>
                    <PageLink
                      page={page}
                      active={view === "page" && activeId === page.id}
                      onNavigate={onClose}
                      padded
                    />
                    {inText ? <p className="px-3 pb-1 text-xs text-walnut-muted">In the page text</p> : null}
                  </div>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-walnut-muted">No pages match.</p>
              )}
            </div>
          ) : (
            <>
              {favorites.length ? (
                <div className="mb-3">
                  <p className="px-3 pb-1 text-xs tracking-wide text-walnut-muted">Favorites</p>
                  {favorites.map((page) => (
                    <PageLink
                      key={page.id}
                      page={page}
                      active={view === "page" && activeId === page.id}
                      onNavigate={onClose}
                      padded
                    />
                  ))}
                </div>
              ) : null}
              <p className="px-3 pb-1 text-xs tracking-wide text-walnut-muted">Pages</p>
              {documents.length ? renderBranch(null, 0) : <p className="px-3 py-2 text-sm text-walnut-muted">No pages yet.</p>}
              {templates.length ? (
                <div className="mt-4">
                  <p className="px-3 pb-1 text-xs tracking-wide text-walnut-muted">Templates</p>
                  {templates.map((page) => (
                    <div key={page.id} className="flex items-center">
                      <PageLink page={page} active={view === "page" && activeId === page.id} onNavigate={onClose} padded />
                      <button
                        type="button"
                        className="h-11 shrink-0 px-2 text-xs text-walnut-muted"
                        onClick={() => onUseTemplate(page.id)}
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </nav>

        <div className="border-t border-walnut-line px-3 py-3">
          <div className="motion-account mb-3 min-w-0 px-1">
            <UserButton />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-walnut-2 p-1">
            <Link
              to="/"
              search={(prev) => ({ page: prev.page, view: "page" })}
              onClick={onClose}
              className={cn(
                "grid h-11 place-items-center rounded-md text-sm",
                view === "page" ? "bg-paper text-ink" : "text-walnut-muted",
              )}
            >
              Page
            </Link>
            <Link
              to="/"
              search={(prev) => ({ page: prev.page, view: "board" })}
              onClick={onClose}
              className={cn(
                "grid h-11 place-items-center rounded-md text-sm",
                view === "board" ? "bg-paper text-ink" : "text-walnut-muted",
              )}
            >
              Board
            </Link>
          </div>
          <p className="mt-3 px-1 text-xs leading-relaxed text-pretty text-walnut-muted">
            Pages stay on your account.{" "}
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-paper underline decoration-copper underline-offset-2"
            >
              Source on GitHub
            </a>
          </p>
        </div>
      </aside>
    </>
  );
}

function PageLink({
  page,
  active,
  onNavigate,
  padded,
}: {
  page: PageSummary;
  active: boolean;
  onNavigate: () => void;
  padded?: boolean;
}) {
  return (
    <Link
      to="/"
      search={{ page: page.id, view: "page" }}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm",
        padded && "px-3",
        active ? "bg-walnut-2 text-paper" : "text-walnut-muted hover:bg-walnut-2 hover:text-paper",
      )}
    >
      <PageIcon name={page.icon} className={active ? "text-copper" : undefined} />
      <span className="truncate">{page.title}</span>
    </Link>
  );
}
