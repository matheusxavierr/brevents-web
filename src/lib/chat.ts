import type { ChatMessage } from "@/lib/api-types";

type RealtimeChatMessage = ChatMessage & { timestamp?: string };

export function normalizeRealtimeChatMessage(payload: Record<string, unknown>, now = new Date()) {
  const message = payload as unknown as RealtimeChatMessage;
  return {
    ...message,
    created_at: message.created_at || message.timestamp || now.toISOString(),
  } satisfies ChatMessage;
}
