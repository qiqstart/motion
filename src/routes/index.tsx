import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignInScreen } from "@/components/studio/sign-in-screen";
import { Studio, StudioPending } from "@/components/studio/studio";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isOfflineError, readStudio } from "@/lib/offline";
import { loadStudio } from "@/lib/pages.functions";
import type { StudioData } from "@/lib/pages";

type HomeData = StudioData & { signedOut: boolean; offline: boolean };

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
      return { ...studio, signedOut: false, offline: false } satisfies HomeData;
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return { pages: [], page: null, signedOut: true, offline: false } satisfies HomeData;
      }
      if (isOfflineError(error)) {
        const cached = await readStudio(deps.page ?? null);
        if (cached) {
          if (!deps.page && deps.view !== "board") {
            const first = cached.pages.find((page) => page.parentId === null && !page.template);
            if (first) throw redirect({ to: "/", search: { page: first.id, view: "page" } });
          }
          return { ...cached, signedOut: false, offline: true } satisfies HomeData;
        }
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
  const [offlineNow, setOfflineNow] = useState(false);
  const [cached, setCached] = useState<StudioData | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);

  useEffect(() => {
    const sync = () => setOfflineNow(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!offlineNow && !data.offline) return;
    let stopped = false;
    void readStudio(search.page ?? data.page?.id ?? null).then((studio) => {
      if (stopped) return;
      if (studio) setCached(studio);
      setCacheChecked(true);
    });
    return () => {
      stopped = true;
    };
  }, [offlineNow, data.offline, data.page?.id, search.page]);

  useEffect(() => {
    if (user && data.signedOut) void router.invalidate();
  }, [user, data.signedOut, router]);

  const offlineStudio = data.offline ? data : cached;
  if (offlineNow && !user && !offlineStudio && !cacheChecked) return <StudioPending />;
  if (offlineStudio && (data.offline || offlineNow)) {
    return <Studio data={{ ...offlineStudio, offline: true }} view={search.view} />;
  }
  if (isPending || (user && data.signedOut)) return <StudioPending />;
  if (!user) return <SignInScreen />;
  return <Studio data={data} view={search.view} />;
}
