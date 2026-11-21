import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const agentConnection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { readSessionToken } = await import("@/lib/auth/server");
    const token = readSessionToken();
    if (!token) throw new Error("Sign in on this site, then copy the agent config again.");
    return { path: "/api/mcp", token };
  });
