export async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {}
    throw new Error(`${url} failed (${res.status} ${res.statusText})${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}
