import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
  type PartialBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { FileText } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import "@blocknote/mantine/style.css";

const motionTheme = {
  colors: {
    editor: { text: "#1c1612", background: "transparent" },
    menu: { text: "#1c1612", background: "#fbf8f3" },
    tooltip: { text: "#f4efe6", background: "#1a1613" },
    hovered: { text: "#1c1612", background: "#efe7db" },
    selected: { text: "#1c1612", background: "#f3e2d4" },
    disabled: { text: "#a3988c", background: "#efe7db" },
    shadow: "#1c161226",
    border: "#e3d9cc",
    sideMenu: "#a3988c",
  },
  borderRadius: 10,
  fontFamily: '"Newsreader", Georgia, serif',
};

type SubpageBridge = {
  create: () => Promise<{ id: string; title: string }>;
  open: (id: string) => void;
  titleOf: (id: string) => string | undefined;
};

const bridge: SubpageBridge = {
  create: async () => ({ id: "", title: "Untitled" }),
  open: () => undefined,
  titleOf: () => undefined,
};

const pendingCreates = new Set<string>();

const Subpage = createReactBlockSpec(
  {
    type: "subpage",
    propSchema: {
      pageId: { default: "" },
      title: { default: "Untitled" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const pageId = props.block.props.pageId;
      const title = (pageId && bridge.titleOf(pageId)) || props.block.props.title || "Untitled";
      useEffect(() => {
        if (pageId || pendingCreates.has(props.block.id)) return;
        pendingCreates.add(props.block.id);
        void bridge
          .create()
          .then((page) => {
            if (!page.id) return;
            props.editor.updateBlock(props.block, { props: { pageId: page.id, title: page.title } });
          })
          .catch(() => {
            pendingCreates.delete(props.block.id);
          });
      }, [pageId, props.block, props.editor]);

      return (
        <button
          type="button"
          className="my-1 flex h-11 w-full items-center gap-2 rounded-md border border-line bg-paper-3 px-3 text-left text-sm text-ink"
          onClick={() => {
            if (pageId) bridge.open(pageId);
          }}
        >
          <FileText className="size-4 text-copper" />
          <span className="truncate">{title}</span>
        </button>
      );
    },
  },
);

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    subpage: Subpage(),
  },
});

function blocksFrom(content: unknown[]): PartialBlock[] | undefined {
  const blocks = content.filter((block) => block && typeof block === "object" && !Array.isArray(block));
  if (!blocks.length) return undefined;
  return blocks as PartialBlock[];
}

export default function PageEditor({
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
  const contentRef = useRef(content);
  const initialContent = useMemo(() => blocksFrom(contentRef.current), [pageId]);
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const editor = useCreateBlockNote(
    {
      schema,
      initialContent,
      animations: !reduce,
      placeholders: {
        default: "Write, or type / for blocks",
        heading: "Heading",
        bulletListItem: "List",
        numberedListItem: "List",
        checkListItem: "To-do",
        quote: "Quote",
      },
    },
    [pageId],
  );

  bridge.create = onCreateSubpage;
  bridge.open = onOpenPage;
  bridge.titleOf = (id) => titles[id];

  return (
    <div className="motion-editor">
      <BlockNoteView
        editor={editor}
        theme={motionTheme}
        slashMenu={false}
        onChange={() => {
          onDocument(JSON.parse(JSON.stringify(editor.document)) as unknown[]);
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                {
                  title: "Subpage",
                  subtext: "Nest a page in this one",
                  aliases: ["page", "link", "embed"],
                  group: "Motion",
                  icon: <FileText className="size-4" />,
                  onItemClick: () => {
                    insertOrUpdateBlockForSlashMenu(editor, {
                      type: "subpage",
                      props: { pageId: "", title: "Untitled" },
                    });
                  },
                },
              ],
              query,
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}
