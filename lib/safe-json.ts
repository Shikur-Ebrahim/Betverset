/** Parse JSON from fetch; surface plain-text errors (e.g. "Not Found") clearly. */
export async function parseJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const hint = text.trim().slice(0, 120);
    throw new Error(
      res.ok
        ? 'Invalid response from server'
        : hint || `Request failed (${res.status})`
    );
  }
}
