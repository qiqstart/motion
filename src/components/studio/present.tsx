import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { collectText, type PageDetail } from "@/lib/pages";

type Slide = { heading: string; blocks: Record<string, unknown>[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function slidesFrom(title: string, blocks: unknown[]): Slide[] {
  const slides: Slide[] = [];
  let current: Slide = { heading: title, blocks: [] };
  for (const item of blocks) {
    const block = asRecord(item);
    if (!block) continue;
    const props = asRecord(block.props);
    const level = typeof props?.level === "number" ? props.level : 2;
    if (block.type === "heading" && level <= 2) {
      if (current.blocks.length || slides.length) slides.push(current);
      current = { heading: collectText(block).join(" ").trim() || title, blocks: [] };
    } else {
      current.blocks.push(block);
    }
  }
  slides.push(current);
  return slides.filter((slide) => slide.heading || slide.blocks.length);
}

export function PresentMode({ page, blocks, onClose }: { page: PageDetail; blocks: unknown[]; onClose: () => void }) {
  const slides = useMemo(() => slidesFrom(page.title, blocks), [page.title, blocks]);
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)] ?? { heading: page.title, blocks: [] };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setIndex((value) => Math.min(slides.length - 1, value + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, slides.length]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-walnut text-paper">
      <div className="flex h-14 items-center justify-between px-3">
        <p className="truncate px-2 text-sm text-walnut-muted">{page.title}</p>
        <div className="flex items-center gap-1">
          <span className="px-2 text-sm tabular-nums text-walnut-muted">
            {index + 1} / {slides.length}
          </span>
          <Button variant="quiet" size="icon" aria-label="Close presentation" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-16">
        <h1 className="font-serif text-4xl text-balance sm:text-6xl">{slide.heading}</h1>
        <div className="mt-8 space-y-4 text-lg leading-relaxed text-paper/90">
          {slide.blocks.map((block, blockIndex) => (
            <PresentBlock key={blockIndex} block={block} />
          ))}
        </div>
      </div>
      <div className="flex justify-between px-3 pb-4">
        <Button
          variant="quiet"
          aria-label="Previous slide"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button
          variant="primary"
          aria-label="Next slide"
          disabled={index >= slides.length - 1}
          onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PresentBlock({ block }: { block: Record<string, unknown> }) {
  const text = collectText(block).join(" ").trim();
  const props = asRecord(block.props);
  if (block.type === "divider") return <hr className="border-walnut-line" />;
  if (block.type === "codeBlock") {
    return (
      <pre className="overflow-x-auto rounded-md bg-black/30 p-4 font-mono text-sm leading-relaxed text-paper">
        {text}
      </pre>
    );
  }
  if (block.type === "quote") return <blockquote className="border-l-2 border-copper pl-4 italic">{text}</blockquote>;
  if (block.type === "checkListItem") {
    const checked = props?.checked === true;
    return (
      <p className="flex gap-3">
        <span className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-sm border border-walnut-muted">
          {checked ? <span className="size-2 bg-copper" /> : null}
        </span>
        <span className={checked ? "text-walnut-muted line-through" : undefined}>{text}</span>
      </p>
    );
  }
  if (block.type === "bulletListItem" || block.type === "toggleListItem") return <p className="pl-4">• {text}</p>;
  if (block.type === "numberedListItem") return <p className="pl-4">{text}</p>;
  if (block.type === "subpage") {
    const title = typeof props?.title === "string" ? props.title : text || "Subpage";
    return <p className="rounded-md border border-walnut-line px-3 py-2 text-base">Page · {title}</p>;
  }
  if (block.type === "image" && typeof props?.url === "string" && props.url.startsWith("https://")) {
    return <img src={props.url} alt="" className="max-h-80 w-full rounded-md object-contain" />;
  }
  if (!text) return null;
  return <p className="text-pretty">{text}</p>;
}
