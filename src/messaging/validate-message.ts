import { contentRequestSchema, type ContentRequest } from './messages';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Maximum serialized message size accepted from a content script. */
const MAX_MESSAGE_BYTES = 512 * 1024;

/**
 * Validates a message received by the service worker. Rejects messages from
 * other extensions, oversized payloads, and anything that fails the schema.
 */
export function validateContentRequest(
  message: unknown,
  sender: { id?: string | undefined },
  extensionId: string,
): ValidationResult<ContentRequest> {
  if (sender.id !== extensionId) return { ok: false, error: 'Message from an unknown sender.' };
  let size: number;
  try {
    size = JSON.stringify(message ?? null).length;
  } catch {
    return { ok: false, error: 'Message is not serializable.' };
  }
  if (size > MAX_MESSAGE_BYTES) return { ok: false, error: 'Message is too large.' };
  const parsed = contentRequestSchema.safeParse(message);
  if (!parsed.success) return { ok: false, error: 'Message failed validation.' };
  return { ok: true, value: parsed.data };
}
