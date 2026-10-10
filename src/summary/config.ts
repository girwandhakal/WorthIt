/**
 * Build-time wording configuration. A public build sets WXT_WORDING_PROXY_URL
 * to a server-side proxy that holds the OpenAI key (see server/wording-proxy);
 * the extension then never stores or sends a key. Unset for the hackathon
 * build, which uses the owner's key from settings.
 */
export function parseProxyUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const WORDING_PROXY_URL: string | null = parseProxyUrl(import.meta.env.WXT_WORDING_PROXY_URL as string | undefined);
