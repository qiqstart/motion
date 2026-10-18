import { ClientOnly } from "@tanstack/react-router";
import { Component, lazy, Suspense, useState, type ReactNode } from "react";

const PageEditor = lazy(() => import("@/components/studio/page-editor"));

class EditorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-md border border-line bg-paper-2 px-4 py-6">
          <p className="text-pretty text-ink">These blocks could not be opened.</p>
          <button
            type="button"
            className="mt-4 h-11 rounded-md bg-copper px-3 text-sm font-medium text-paper"
            onClick={() => {
              this.props.onReset();
              this.setState({ failed: false });
            }}
          >
            Clear the page body
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function EditorHost({
  pageId,
  content,
  titles,
  onDocument,
  onOpenPage,
  onCreateSubpage,
}: {
  pageId: string;
  content: unknown[];
  titles: Record<string, string>;
  onDocument: (blocks: unknown[]) => void;
  onOpenPage: (id: string) => void;
  onCreateSubpage: () => Promise<{ id: string; title: string }>;
}) {
  const [attempt, setAttempt] = useState(0);

  return (
    <EditorBoundary
      key={attempt}
      onReset={() => {
        onDocument([]);
        setAttempt((value) => value + 1);
      }}
    >
      <ClientOnly fallback={<EditorSkeleton />}>
        <Suspense fallback={<EditorSkeleton />}>
          <PageEditor
            key={`${pageId}-${attempt}`}
            pageId={pageId}
            content={attempt === 0 ? content : []}
            titles={titles}
            onDocument={onDocument}
            onOpenPage={onOpenPage}
            onCreateSubpage={onCreateSubpage}
          />
        </Suspense>
      </ClientOnly>
    </EditorBoundary>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-hidden="true">
      <div className="h-4 w-10/12 rounded-sm bg-paper-2" />
      <div className="h-4 w-8/12 rounded-sm bg-paper-2" />
      <div className="h-4 w-9/12 rounded-sm bg-paper-2" />
    </div>
  );
}
