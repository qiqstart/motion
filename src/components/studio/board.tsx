import { PageIcon } from "@/components/studio/icons";
import { formatEdited, STATUSES, statusLabel, type PageSummary, type StatusName } from "@/lib/pages";

export function Board({
  pages,
  busy,
  onOpen,
  onStatus,
}: {
  pages: PageSummary[];
  busy: boolean;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: StatusName) => void;
}) {
  return (
    <div className="page-rise mx-auto grid w-full max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-3">
      {STATUSES.map((status) => {
        const column = pages.filter((page) => page.status === status);
        return (
          <section
            key={status}
            aria-label={statusLabel(status)}
            className="flex min-h-64 flex-col rounded-lg border border-line bg-paper-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("text/plain");
              if (id) onStatus(id, status);
            }}
          >
            <header className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="font-serif text-2xl">{statusLabel(status)}</h2>
              <span className="text-sm text-muted tabular-nums">{column.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
              {column.length ? (
                column.map((page) => (
                  <article
                    key={page.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", page.id)}
                    className="rounded-md border border-line bg-paper p-3"
                  >
                    <button type="button" onClick={() => onOpen(page.id)} className="flex w-full items-start gap-2 text-left">
                      <span className="mt-0.5 grid size-8 place-items-center rounded-md bg-paper-2 text-ink">
                        <PageIcon name={page.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{page.title}</span>
                        <span className="text-sm text-muted">Edited {formatEdited(page.updatedAt)}</span>
                      </span>
                    </button>
                    <label className="mt-3 block">
                      <span className="sr-only">Status for {page.title}</span>
                      <select
                        value={page.status}
                        disabled={busy}
                        onChange={(event) => onStatus(page.id, event.target.value as StatusName)}
                        className="h-11 w-full rounded-md border border-line bg-paper px-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
                      >
                        {STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {statusLabel(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))
              ) : (
                <p className="px-1 py-6 text-sm text-pretty text-muted">Nothing yet.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
