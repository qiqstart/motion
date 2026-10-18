import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { askMotion, type AiPlan } from "@/lib/ai.functions";

const CHIPS = [
  "Continue this page in the same voice",
  "Summarize this page",
  "Tighten the writing and give me a cleaner version to append",
  "Create a subpage of the action items",
  "Set the status to live if it reads finished, otherwise draft",
];

export function AskMotion({
  pageId,
  busy,
  onApply,
}: {
  pageId: string;
  busy: boolean;
  onApply: (plan: AiPlan) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiPlan | null>(null);

  async function ask(nextInstruction: string) {
    const text = nextInstruction.trim();
    if (!text || asking) return;
    setInstruction(text);
    setAsking(true);
    setError(null);
    setPlan(null);
    try {
      const result = await askMotion({ data: { pageId, instruction: text } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPlan(result.plan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI could not answer");
    } finally {
      setAsking(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setPlan(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button aria-label="Ask Motion" disabled={busy}>
          <Sparkles className="size-4 text-copper" />
          Ask
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-walnut/40" />
        <Dialog.Content className="fixed inset-x-4 top-16 z-50 mx-auto max-w-lg rounded-lg border border-line bg-paper p-5">
          <Dialog.Title className="font-serif text-3xl text-balance">Ask Motion</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-pretty text-muted">
            Tell it what to do with this page. Nothing changes until you apply it.
          </Dialog.Description>
          <div className="mt-4 flex flex-wrap gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="h-11 rounded-md border border-line px-3 text-left text-sm text-ink hover:bg-paper-2"
                onClick={() => void ask(chip)}
                disabled={asking}
              >
                {chip}
              </button>
            ))}
          </div>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Rewrite the opening, or draft a subpage"
            rows={3}
            className="mt-3 w-full resize-none rounded-md border border-line bg-paper-3 px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
          />
          <div className="mt-3 flex justify-end">
            <Button variant="primary" disabled={asking || !instruction.trim()} onClick={() => void ask(instruction)}>
              {asking ? "Asking" : "Ask"}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-copper-deep">
              {error}
            </p>
          ) : null}
          {plan ? (
            <div className="mt-4 rounded-md border border-line bg-paper-3 p-3">
              <p className="text-xs tracking-wide text-muted">{planLabel(plan)}</p>
              <p className="mt-2 text-sm text-pretty whitespace-pre-wrap text-ink">
                {plan.op === "replace_title" ? plan.title : plan.op === "set_status" ? plan.status : plan.text}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                {plan.op === "reply" ? null : (
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => {
                      void onApply(plan).then(() => setOpen(false));
                    }}
                  >
                    Apply
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function planLabel(plan: AiPlan): string {
  if (plan.op === "append") return "Add to the page";
  if (plan.op === "replace_title") return "New title";
  if (plan.op === "set_status") return "Status";
  if (plan.op === "new_page") return plan.title ? `New page · ${plan.title}` : "New page";
  return "Answer";
}
