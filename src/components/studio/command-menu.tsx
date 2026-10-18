import { Command } from "cmdk";
import { PageIcon } from "@/components/studio/icons";
import type { PageSummary } from "@/lib/pages";

export function CommandMenu({
  open,
  pages,
  onOpenChange,
  onOpenPage,
  onCreate,
  onBoard,
}: {
  open: boolean;
  pages: PageSummary[];
  onOpenChange: (open: boolean) => void;
  onOpenPage: (id: string) => void;
  onCreate: () => void;
  onBoard: () => void;
}) {
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-walnut/40"
      contentClassName="fixed inset-x-4 top-24 z-50 mx-auto max-w-xl overflow-hidden rounded-lg border border-line bg-paper"
    >
      <Command.Input
        placeholder="Search titles and page text"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-base outline-none placeholder:text-faint"
      />
      <Command.List className="max-h-80 overflow-y-auto p-1">
        <Command.Empty className="px-3 py-6 text-sm text-muted">No matches.</Command.Empty>
        <Command.Group heading="Actions" className="px-1 py-1 text-xs tracking-wide text-muted">
          <Command.Item
            value="new page"
            onSelect={() => {
              onOpenChange(false);
              onCreate();
            }}
            className="flex h-11 cursor-pointer items-center rounded-md px-3 text-sm text-ink data-[selected=true]:bg-copper-soft"
          >
            New page
          </Command.Item>
          <Command.Item
            value="open board"
            onSelect={() => {
              onOpenChange(false);
              onBoard();
            }}
            className="flex h-11 cursor-pointer items-center rounded-md px-3 text-sm text-ink data-[selected=true]:bg-copper-soft"
          >
            Open board
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Pages" className="px-1 py-1 text-xs tracking-wide text-muted">
          {pages.map((page) => (
            <Command.Item
              key={page.id}
              value={`${page.title} ${page.searchText} ${page.id}`}
              onSelect={() => {
                onOpenChange(false);
                onOpenPage(page.id);
              }}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-ink data-[selected=true]:bg-copper-soft"
            >
              <PageIcon name={page.icon} />
              <span className="truncate">{page.title}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
