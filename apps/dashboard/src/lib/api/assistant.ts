/**
 * @module Assistant API
 *
 * Client for the real AI assistant endpoint. The dashboard chat talks to
 * `POST /api/v1/assistant/chat`; there is NO canned/simulated fallback.
 *
 * When no LLM key is configured the server answers with
 * `{ status: 'unavailable', reason: 'no_llm_key', message }` and the UI shows
 * an honest "assistant unavailable" state.
 */

import { apiFetch } from './client';

export type AssistantStatus = 'ok' | 'unavailable' | 'error';

export interface AssistantChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AssistantChatResponse {
  /** Result status reported by the server. */
  status: AssistantStatus;
  /** Assistant answer (status 'ok') or an honest explanation otherwise. */
  message: string;
  /** Machine-readable reason when not 'ok' (e.g. 'no_llm_key'). */
  reason?: string;
}

/** Normalize the server payload into a stable {@link AssistantChatResponse}. */
function normalize(data: Record<string, unknown>): AssistantChatResponse {
  const status = (data.status as AssistantStatus) ?? 'ok';
  const message =
    (typeof data.message === 'string' && data.message) ||
    (typeof data.reply === 'string' && (data.reply as string)) ||
    (typeof data.content === 'string' && (data.content as string)) ||
    '';
  return {
    status,
    message,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
  };
}

/**
 * Send a chat turn to the assistant. Grounded in the given project's analysis
 * when `projectId` is provided. Throws on transport/HTTP failure (the caller
 * renders an error state).
 */
export async function sendAssistantChat(
  messages: AssistantChatMessage[],
  projectId?: string,
): Promise<AssistantChatResponse> {
  const data = await apiFetch<Record<string, unknown>>('/api/v1/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, ...(projectId ? { projectId } : {}) }),
    headers: { 'Content-Type': 'application/json' },
  });
  return normalize(data ?? {});
}

/**
 * Probe assistant availability without generating a real answer, via
 * `GET /api/v1/assistant/status`. The server reports availability from config
 * only (no model call, no token cost). The status endpoint returns
 * `{ status: 'available' | 'unavailable', reason? }`; we map 'available' → 'ok'
 * so the UI's availability state resolves honestly on load. Any transport error
 * resolves to 'error' so the UI can stay neutral ("Checking…").
 */
export async function probeAssistant(): Promise<AssistantChatResponse> {
  try {
    const data = await apiFetch<Record<string, unknown>>('/api/v1/assistant/status');
    const raw = (data?.status as string) ?? 'unavailable';
    const status: AssistantStatus = raw === 'available' ? 'ok' : 'unavailable';
    return {
      status,
      message: typeof data?.message === 'string' ? data.message : '',
      reason: typeof data?.reason === 'string' ? data.reason : undefined,
    };
  } catch {
    return { status: 'error', message: '' };
  }
}
