import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Link } from "@tanstack/react-router";
import { Check, MoreHorizontal, Plus, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AskMotion } from "@/components/studio/ask-motion";
import { EditorHost } from "@/components/studio/editor-host";
import { PageIcon } from "@/components/studio/icons";
import { PresentMode } from "@/components/studio/present";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  ancestors,
  asBlocks,
  COVERS,
  countWords,
  formatEdited,
  ICONS,
  paragraphsFromText,
  STATUSES,
  statusLabel,
  type CoverName,
  type IconName,
  type PageDetail,
  type PagePatch,
  type PageProperty,
  type PageSummary,
  type StatusName,
} from "@/lib/pages";
import type { AiPlan } from "@/lib/ai.functions";

const COVERS_CLASS: Record<CoverName, string> = {
  none: "",
  wash: "bg-gradient-to-br from-copper-soft to-paper-2",
  ink: "bg-walnut",
  copper: "bg-copper-soft",
};

export function PageView({
  page,
  pages,
  busy,
  onPatch,
  onCreateSubpage,
  onCreateInline,
  onOpenPage,
  onDuplicate,
  onSaveTemplate,
  onUseTemplate,
  onDraftSubpage,
  onDelete,
}: {
  page: PageDetail;
  pages: PageSummary[];
  busy: boolean;
  onPatch: (patch: PagePatch, silent?: boolean) => Promise<void>;
  onCreateSubpage: () => void;
  onCreateInline: () => Promise<{ id: string; title: string }>;
  onOpenPage: (id: string) => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
  onUseTemplate: () => void;
  onDraftSubpage: (title: string, text: string) => Promise<void>;
  onDelete: () => void;
}) {
  const blocks = asBlocks(page.content);
  const [title, setTitle] = useState(page.title);
  const [properties, setProperties] = useState(page.properties);
  const [presenting, setPresenting] = useState(false);
  const [words, setWords] = useState(() => countWords(blocks));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentTimer = useRef<number | null>(null);
  const titleTimer = useRef<number | null>(null);
  const propertyTimer = useRef<number | null>(null);
  const pendingContent = useRef<unknown[] | null>(null);
  const pendingTitle = useRef<string | null>(null);
  const pendingProperties = useRef<PageProperty[] | null>(null);
  const failedContent = useRef<unknown[] | null>(null);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  const trail = ancestors(pages, page.parentId);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    return () => {
      if (contentTimer.current) window.clearTimeout(contentTimer.current);
      if (titleTimer.current) window.clearTimeout(titleTimer.current);
      if (propertyTimer.current) window.clearTimeout(propertyTimer.current);
      const content = pendingContent.current;
      const nextTitle = pendingTitle.current;
      const nextProperties = pendingProperties.current;
      pendingContent.current = null;
      pendingTitle.current = null;
      pendingProperties.current = null;
      if (nextTitle !== null) void onPatchRef.current({ title: nextTitle });
      if (nextProperties) void onPatchRef.current({ properties: nextProperties }, true);
      if (content) void onPatchRef.current({ content }, true);
    };
  }, []);

  function queueTitle(value: string) {
    setTitle(value);
    pendingTitle.current = value;
    if (titleTimer.current) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      const next = pendingTitle.current;
      pendingTitle.current = null;
      if (next === null) return;
      setSaveState("saving");
      void onPatchRef
        .current({ title: next })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 450);
  }

  function queueContent(blocks: unknown[]) {
    pendingContent.current = blocks;
    setWords(countWords(blocks));
    setSaveState("saving");
    if (contentTimer.current) window.clearTimeout(contentTimer.current);
    contentTimer.current = window.setTimeout(() => {
      const next = pendingContent.current;
      pendingContent.current = null;
      if (!next) return;
      void onPatchRef
        .current({ content: next }, true)
        .then(() => setSaveState("saved"))
        .catch(() => {
          failedContent.current = next;
          setSaveState("error");
        });
    }, 650);
  }

  function queueProperties(next: PageProperty[]) {
    setProperties(next);
    pendingProperties.current = next;
    if (propertyTimer.current) window.clearTimeout(propertyTimer.current);
    propertyTimer.current = window.setTimeout(() => {
      const value = pendingProperties.current;
      pendingProperties.current = null;
      if (!value) return;
      setSaveState("saving");
      void onPatchRef
        .current({ properties: value }, true)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 500);
  }

  async function applyPlan(plan: AiPlan) {
    if (plan.op === "append" && plan.text) {
      await onPatch({ content: [...blocks, ...paragraphsFromText(plan.text)] }, true);
    } else if (plan.op === "replace_title" && plan.title) {
      setTitle(plan.title);
      await onPatch({ title: plan.title });
    } else if (plan.op === "set_status" && plan.status) {
      await onPatch({ status: plan.status });
    } else if (plan.op === "new_page") {
      await onDraftSubpage(plan.title || "Untitled", plan.text);
    }
  }

  const titles = Object.fromEntries(pages.map((item) => [item.id, item.title]));
  const cover = page.cover in COVERS_CLASS ? (page.cover as CoverName) : "none";

  return (
    <article className="page-rise">
      {cover !== "none" ? <div className={cn("h-28 sm:h-40", COVERS_CLASS[cover])} /> : null}
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-8">
        <div className={cn("flex items-end gap-3", cover === "none" ? "pt-8" : "-mt-6")}>
          <Appearance
            icon={page.icon}
            cover={cover}
            disabled={busy}
            onIcon={(icon) => void onPatch({ icon })}
            onCover={(next) => void onPatch({ cover: next })}
          />
          {cover === "none" ? (
            <Appearance
              icon={page.icon}
              cover={cover}
              disabled={busy}
              label="Add a cover"
              onIcon={(icon) => void onPatch({ icon })}
              onCover={(next) => void onPatch({ cover: next })}
            />
          ) : null}
        </div>

        {trail.length ? (
          <nav aria-label="Page path" className="mt-4 flex flex-wrap items-center gap-1 text-sm text-muted">
            {trail.map((crumb, index) => (
              <span key={crumb.id} className="flex items-center gap-1">
                {index ? <span aria-hidden="true">/</span> : null}
                <Link to="/" search={{ page: crumb.id, view: "page" }} className="hover:text-ink">
                  {crumb.title}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}

        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          aria-label="Page title"
          placeholder="Untitled"
          onChange={(event) => queueTitle(event.target.value)}
          className="mt-3 w-full resize-none bg-transparent font-serif text-4xl leading-tight text-balance text-ink outline-none placeholder:text-faint sm:text-5xl"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-line p-1" role="group" aria-label="Status">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={page.status === status}
                disabled={busy}
                onClick={() => void onPatch({ status })}
                className={cn(
                  "h-11 rounded-md px-3 text-sm transition-colors",
                  page.status === status ? "bg-ink text-paper" : "text-muted hover:bg-paper-2",
                )}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted tabular-nums">{words} words</p>
          <p className="text-sm text-muted">{saveLabel(saveState, page.updatedAt)}</p>
          {page.template ? <p className="text-sm text-copper-deep">Template</p> : null}
          {saveState === "error" ? (
            <button
              type="button"
              className="text-sm text-copper-deep underline"
              onClick={() => {
                const content = failedContent.current;
                if (!content) return;
                setSaveState("saving");
                void onPatch({ content }, true)
                  .then(() => {
                    failedContent.current = null;
                    setSaveState("saved");
                  })
                  .catch(() => setSaveState("error"));
              }}
            >
              Retry
            </button>
          ) : null}
          <div className="ml-auto flex items-center">
            <Button onClick={() => setPresenting(true)}>Present</Button>
            <AskMotion pageId={page.id} busy={busy} onApply={applyPlan} />
            {page.template ? (
              <Button variant="primary" disabled={busy} onClick={onUseTemplate}>
                Use
              </Button>
            ) : null}
            <Button
              size="icon"
              aria-pressed={page.favorite}
              aria-label={page.favorite ? "Remove from favorites" : "Add to favorites"}
              disabled={busy}
              onClick={() => void onPatch({ favorite: !page.favorite })}
            >
              <Star className={cn("size-4", page.favorite && "fill-copper text-copper")} />
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button size="icon" aria-label="Page actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-44 rounded-md border border-line bg-paper-3 p-1 text-sm shadow-none"
                >
                  <MenuItem onSelect={onCreateSubpage}>New subpage</MenuItem>
                  <MenuItem onSelect={onDuplicate}>Duplicate</MenuItem>
                  {page.template ? null : <MenuItem onSelect={onSaveTemplate}>Save as template</MenuItem>}
                  <MenuItem onSelect={() => setConfirmDelete(true)}>Delete</MenuItem>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <PropertiesEditor properties={properties} disabled={busy} onChange={queueProperties} />

        <div className="mt-6">
          <EditorHost
            pageId={page.id}
            content={blocks}
            titles={titles}
            onDocument={queueContent}
            onOpenPage={onOpenPage}
            onCreateSubpage={onCreateInline}
          />
        </div>

        {page.backlinks.length ? (
          <section className="mt-10 border-t border-line pt-4">
            <h2 className="text-xs tracking-wide text-muted">Backlinks</h2>
            <ul className="mt-2">
              {page.backlinks.map((link) => (
                <li key={link.id}>
                  <Link
                    to="/"
                    search={{ page: link.id, view: "page" }}
                    className="flex h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-paper-2"
                  >
                    <PageIcon name={link.icon} />
                    <span className="truncate">{link.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-walnut/40" />
          <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-lg border border-line bg-paper p-6">
            <Dialog.Title className="font-serif text-2xl text-balance">Delete this page?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-pretty text-muted">
              This removes the page and anything nested under it. It cannot be undone.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="line">Keep</Button>
              </Dialog.Close>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {presenting ? <PresentMode page={page} blocks={blocks} onClose={() => setPresenting(false)} /> : null}
    </article>
  );
}

function PropertiesEditor({
  properties,
  disabled,
  onChange,
}: {
  properties: PageProperty[];
  disabled: boolean;
  onChange: (next: PageProperty[]) => void;
}) {
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-wide text-muted">Properties</h2>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-1 px-2 text-sm text-muted"
          disabled={disabled || properties.length >= 16}
          onClick={() => onChange([...properties, { id: crypto.randomUUID(), name: "Label", value: "" }])}
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>
      {properties.length ? (
        <ul className="mt-1">
          {properties.map((property) => (
            <li key={property.id} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.75rem] items-center gap-2">
              <input
                aria-label="Property name"
                value={property.name}
                disabled={disabled}
                onChange={(event) =>
                  onChange(properties.map((item) => (item.id === property.id ? { ...item, name: event.target.value } : item)))
                }
                className="h-11 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none focus-visible:border-line"
              />
              <input
                aria-label={`${property.name} value`}
                value={property.value}
                disabled={disabled}
                placeholder="Empty"
                onChange={(event) =>
                  onChange(
                    properties.map((item) => (item.id === property.id ? { ...item, value: event.target.value } : item)),
                  )
                }
                className="h-11 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none focus-visible:border-line"
              />
              <button
                type="button"
                aria-label={`Remove ${property.name}`}
                className="grid size-11 place-items-center text-muted"
                onClick={() => onChange(properties.filter((item) => item.id !== property.id))}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 text-sm text-muted">No custom properties yet.</p>
      )}
    </section>
  );
}

function saveLabel(state: "idle" | "saving" | "saved" | "error", updatedAt: string) {
  if (state === "saving") return "Saving";
  if (state === "saved") return "Saved";
  if (state === "error") return "Couldn’t save";
  const edited = formatEdited(updatedAt);
  return edited ? `Edited ${edited}` : "";
}

function MenuItem({ children, onSelect }: { children: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-11 cursor-pointer items-center rounded-md px-3 outline-none data-[highlighted]:bg-copper-soft"
    >
      {children}
    </DropdownMenu.Item>
  );
}

function Appearance({
  icon,
  cover,
  disabled,
  label,
  onIcon,
  onCover,
}: {
  icon: string;
  cover: CoverName;
  disabled: boolean;
  label?: string;
  onIcon: (icon: IconName) => void;
  onCover: (cover: CoverName) => void;
}) {
  if (label) {
    return (
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="line" disabled={disabled}>
            {label}
          </Button>
        </Popover.Trigger>
        <AppearancePanel icon={icon} cover={cover} onIcon={onIcon} onCover={onCover} />
      </Popover.Root>
    );
  }
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Change icon and cover"
          className="grid size-12 place-items-center rounded-lg border border-line bg-paper text-ink"
        >
          <PageIcon name={icon} className="size-5" />
        </button>
      </Popover.Trigger>
      <AppearancePanel icon={icon} cover={cover} onIcon={onIcon} onCover={onCover} />
    </Popover.Root>
  );
}

function AppearancePanel({
  icon,
  cover,
  onIcon,
  onCover,
}: {
  icon: string;
  cover: CoverName;
  onIcon: (icon: IconName) => void;
  onCover: (cover: CoverName) => void;
}) {
  return (
    <Popover.Portal>
      <Popover.Content
        sideOffset={8}
        className="z-50 w-72 rounded-lg border border-line bg-paper-3 p-3"
      >
        <p className="px-1 pb-2 text-xs tracking-wide text-muted">Icon</p>
        <div className="grid grid-cols-5 gap-1">
          {ICONS.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={icon === name}
              onClick={() => onIcon(name)}
              className={cn(
                "grid size-11 place-items-center rounded-md",
                icon === name ? "bg-copper-soft text-ink" : "hover:bg-paper-2",
              )}
            >
              <PageIcon name={name} />
            </button>
          ))}
        </div>
        <p className="px-1 pt-3 pb-2 text-xs tracking-wide text-muted">Cover</p>
        <div className="grid grid-cols-4 gap-2">
          {COVERS.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name === "none" ? "No cover" : `${name} cover`}
              aria-pressed={cover === name}
              onClick={() => onCover(name)}
              className={cn(
                "relative h-11 rounded-md border",
                name === "none" ? "border-line bg-paper" : "border-transparent",
                COVERS_CLASS[name],
                cover === name && "outline-2 outline-offset-2 outline-copper",
              )}
            >
              {name === "none" ? <span className="text-xs text-muted">None</span> : null}
              {cover === name ? (
                <Check className={cn("absolute right-1 bottom-1 size-3", name === "ink" ? "text-paper" : "text-ink")} />
              ) : null}
            </button>
          ))}
        </div>
      </Popover.Content>
    </Popover.Portal>
  );
}
