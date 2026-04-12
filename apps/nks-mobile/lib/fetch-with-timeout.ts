/**
 * fetchWithTimeout — Wraps native fetch with AbortController timeout.
 *
 * React Native's fetch ignores the `timeout` option; this wrapper ensures
 * requests always fail fast instead of hanging indefinitely.
 *
 * @param url      - Request URL
 * @param options  - Standard RequestInit (timeout ignored — use timeoutMs)
 * @param timeoutMs - Abort after this many milliseconds (default: 10_000)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
