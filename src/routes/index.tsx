import { createFileRoute, redirect } from "@tanstack/react-router";
import { Studio, StudioPending } from "@/components/studio/studio";
import { loadStudio } from "@/lib/pages.functions";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" && search.page.length > 0 ? search.page : undefined,
    view: search.view === "board" ? ("board" as const) : ("page" as const),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, view: search.view }),
  loader: async ({ deps }) => {
    const studio = await loadStudio({ data: { pageId: deps.page ?? null } });
    if (!deps.page && deps.view !== "board") {
      const first = studio.pages.find((page) => page.parentId === null);
      if (first) throw redirect({ to: "/", search: { page: first.id, view: "page" } });
    }
    return studio;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.page ? `${loaderData.page.title} · Motion` : "Motion" }],
  }),
  pendingComponent: StudioPending,
  pendingMs: 200,
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  return <Studio data={data} view={search.view} />;
}
