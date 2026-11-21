import { McpServer } from "@modelcontextprotocol/server";
import {
  MOTION_TOOL_DESCRIPTIONS,
  MOTION_TOOL_NAMES,
  motionToolSchema,
  runMotionTool,
  type MotionToolApi,
} from "@/lib/mcp-tools";
import { createPageRow, deletePageRow, loadStudioData, updatePageRow } from "@/lib/pages.server";

const database: MotionToolApi = {
  list: async (userId) => (await loadStudioData(userId, null)).pages,
  read: async (userId, id) => (await loadStudioData(userId, id)).page,
  create: async (userId, input) => {
    const created = await createPageRow(userId, { title: input.title, parentId: input.parentId });
    if (input.content) await updatePageRow(userId, created.id, { content: input.content });
    return created;
  },
  update: (userId, id, patch) => updatePageRow(userId, id, patch),
  delete: (userId, id) => deletePageRow(userId, id),
};

export function motionServer(userId: string, api: MotionToolApi = database): McpServer {
  const server = new McpServer({ name: "motion", version: "1.0.0" });
  for (const name of MOTION_TOOL_NAMES) {
    server.registerTool(
      name,
      { description: MOTION_TOOL_DESCRIPTIONS[name], inputSchema: motionToolSchema(name) },
      async (args) => {
        const result = await runMotionTool(userId, name, args, api);
        return {
          isError: result.isError || undefined,
          content: [{ type: "text" as const, text: result.text }],
        };
      },
    );
  }
  return server;
}
