export async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      detail = body.slice(0, 300);
    } catch {
      // ignore
    }
    throw new Error(`${url} failed (${res.status} ${res.statusText})${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}
