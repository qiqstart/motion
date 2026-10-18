import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useMemo, useRef } from "react";
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

function blocksFrom(content: unknown[]): PartialBlock[] | undefined {
  const blocks = content.filter((block) => block && typeof block === "object" && !Array.isArray(block));
  if (!blocks.length) return undefined;
  return blocks as PartialBlock[];
}

export default function PageEditor({
  pageId,
  content,
  onDocument,
}: {
  pageId: string;
  content: unknown[];
  onDocument: (blocks: unknown[]) => void;
}) {
  const contentRef = useRef(content);
  const initialContent = useMemo(() => blocksFrom(contentRef.current), [pageId]);
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const editor = useCreateBlockNote(
    {
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

  return (
    <div className="motion-editor">
      <BlockNoteView
        editor={editor}
        theme={motionTheme}
        onChange={() => {
          onDocument(JSON.parse(JSON.stringify(editor.document)) as unknown[]);
        }}
      />
    </div>
  );
}
