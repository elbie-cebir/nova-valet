/**
 * Parse the ids out of a WhatsApp webhook payload. Inbound customer messages
 * arrive under `entry[].changes[].value.messages[]`; delivery/read receipts
 * under `.statuses[]`. Defensive: any shape mismatch yields empty arrays.
 */
export function parseWhatsAppEvents(payload: unknown): {
  messageIds: string[];
  statusIds: string[];
} {
  const messageIds: string[] = [];
  const statusIds: string[] = [];
  const p = payload as {
    entry?: {
      changes?: {
        value?: {
          messages?: { id?: string }[];
          statuses?: { id?: string }[];
        };
      }[];
    }[];
  };
  for (const entry of p?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const m of change?.value?.messages ?? []) {
        if (m?.id) messageIds.push(m.id);
      }
      for (const s of change?.value?.statuses ?? []) {
        if (s?.id) statusIds.push(s.id);
      }
    }
  }
  return { messageIds, statusIds };
}

/**
 * Return only the ids not already in `seen`, and record them. Makes webhook
 * processing idempotent: a redelivered event with the same id is a no-op.
 */
export function dedupeNewIds(ids: string[], seen: Set<string>): string[] {
  const fresh: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      fresh.push(id);
    }
  }
  return fresh;
}
