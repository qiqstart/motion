import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { SignInScreen } from "@/components/studio/sign-in-screen";
import { Studio, StudioPending } from "@/components/studio/studio";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadStudio } from "@/lib/pages.functions";
import type { StudioData } from "@/lib/pages";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" && search.page.length > 0 ? search.page : undefined,
    view: search.view === "board" ? ("board" as const) : ("page" as const),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, view: search.view }),
  loader: async ({ deps }) => {
    try {
      const studio = await loadStudio({ data: { pageId: deps.page ?? null } });
      if (!deps.page && deps.view !== "board") {
        const first = studio.pages.find((page) => page.parentId === null && !page.template);
        if (first) throw redirect({ to: "/", search: { page: first.id, view: "page" } });
      }
      return { ...studio, signedOut: false as const };
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return { pages: [], page: null, signedOut: true as const } satisfies StudioData & { signedOut: true };
      }
      throw error;
    }
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
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    if (user && data.signedOut) void router.invalidate();
  }, [user, data.signedOut, router]);

  if (isPending || (user && data.signedOut)) return <StudioPending />;
  if (!user) return <SignInScreen />;
  return <Studio data={data} view={search.view} />;
}
