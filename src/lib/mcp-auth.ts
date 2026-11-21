export function decideCaller(input: {
  authConfigured: boolean;
  databaseConfigured: boolean;
  sessionUserId: string | null;
  devUserId: string;
}): string | null {
  if (!input.authConfigured) return input.databaseConfigured ? null : input.devUserId;
  return input.sessionUserId;
}

export function bearerToken(header: string | null): string {
  const match = /^Bearer\s+(\S+)/i.exec(header?.trim() ?? "");
  return match?.[1] ?? "session";
}

export function agentConfig(origin: string, path: string, token: string) {
  return {
    mcpServers: {
      motion: {
        url: `${origin}${path}`,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  };
}
