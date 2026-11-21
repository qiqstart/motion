import { createMcpHandler } from "@modelcontextprotocol/server";
import { createFileRoute } from "@tanstack/react-router";
import { auth, authConfigured } from "@/lib/auth/server";
import { bearerToken, decideCaller } from "@/lib/mcp-auth";
import { motionServer } from "@/lib/mcp.server";
import { DEV_USER_ID } from "@/lib/auth/verify.server";

const mcp = createMcpHandler(({ authInfo }) => motionServer(authInfo?.clientId ?? ""), { responseMode: "json" });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

async function callerId(request: Request): Promise<string | null> {
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const session = authConfigured ? await auth.api.getSession({ headers: request.headers }) : null;
  return decideCaller({
    authConfigured,
    databaseConfigured,
    sessionUserId: session?.user?.id ?? null,
    devUserId: DEV_USER_ID,
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function respond(request: Request): Promise<Response> {
  const userId = await callerId(request);
  if (!userId) {
    return withCors(
      new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="motion"', "content-type": "text/plain" },
      }),
    );
  }
  return withCors(
    await mcp.fetch(request, {
      authInfo: { token: bearerToken(request.headers.get("authorization")), clientId: userId, scopes: ["pages"] },
    }),
  );
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => respond(request),
      POST: ({ request }) => respond(request),
      DELETE: ({ request }) => respond(request),
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
    },
  },
});
