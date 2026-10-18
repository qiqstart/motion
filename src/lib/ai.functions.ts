import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isId, isStatus, type StatusName } from "@/lib/pages";
import { readPageForAsk } from "@/lib/pages.server";

const OPS = ["reply", "append", "replace_title", "set_status", "new_page"] as const;
export type AiOp = (typeof OPS)[number];

export type AiPlan = {
  op: AiOp;
  text: string;
  title: string;
  status: StatusName | "";
};

function readObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid request");
  return data as Record<string, unknown>;
}

function parsePlan(raw: string): AiPlan {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { op: "reply", text: trimmed.slice(0, 2000), title: "", status: "" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch {
    return { op: "reply", text: trimmed.slice(0, 2000), title: "", status: "" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { op: "reply", text: trimmed.slice(0, 2000), title: "", status: "" };
  }
  const record = parsed as Record<string, unknown>;
  const op = OPS.includes(record.op as AiOp) ? (record.op as AiOp) : "reply";
  const text = typeof record.text === "string" ? record.text.trim().slice(0, 4000) : "";
  const title = typeof record.title === "string" ? record.title.replace(/\s+/g, " ").trim().slice(0, 180) : "";
  const status = typeof record.status === "string" && isStatus(record.status) ? record.status : "";
  return { op, text, title, status };
}

export const askMotion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { pageId: string; instruction: string }) => {
    const body = readObject(data);
    if (typeof body.pageId !== "string" || !isId(body.pageId)) throw new Error("Unknown page");
    if (typeof body.instruction !== "string") throw new Error("Write an instruction first");
    const instruction = body.instruction.replace(/\s+/g, " ").trim().slice(0, 500);
    if (!instruction) throw new Error("Write an instruction first");
    return { pageId: body.pageId, instruction };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available right now" };

    const page = await readPageForAsk(context.userId, data.pageId);
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              'You control one page in a writing app. Reply with JSON only, no markdown: {"op":"reply"|"append"|"replace_title"|"set_status"|"new_page","text":"","title":"","status":"idea"|"draft"|"live"}. reply answers without changing the page. append is prose to add, paragraphs separated by a blank line. replace_title sets title. set_status uses idea, draft, or live. new_page needs title and text for a subpage. Stay under 180 words. Do not invent people, dates, or private facts that are not already in the page.',
          },
          {
            role: "user",
            content: `Title: ${page.title}\nStatus: ${page.status}\nProperties:\n${page.properties || "(none)"}\n\nBody:\n${page.body || "(empty)"}\n\nInstruction: ${data.instruction}`,
          },
        ],
      }),
    });
    if (!response.ok) return { ok: false as const, error: "AI could not answer. Try again." };
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    if (!raw.trim()) return { ok: false as const, error: "AI returned an empty answer" };
    return { ok: true as const, plan: parsePlan(raw) };
  });
