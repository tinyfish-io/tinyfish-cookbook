export type Route =
  | { name: "home"; task: string; url: string }
  | { name: "audits" }
  | { name: "redirect"; to: string }
  | { name: "audit"; id: string }
  | { name: "shared"; token: string }
  | { name: "compare"; ids: string[] }
  | { name: "not_found" };

export function matchRoute(pathname: string, search: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  const query = new URLSearchParams(search);
  const [head, id] = parts;

  if (parts.length === 0) {
    return { name: "home", task: query.get("task") ?? "", url: query.get("url") ?? "" };
  }
  if (parts.length === 1 && head === "new") return { name: "redirect", to: `/${search}` };
  if (parts.length === 1 && head === "audits") return { name: "audits" };
  if (parts.length === 1 && head === "compare") {
    return { name: "compare", ids: (query.get("audits") ?? "").split(",").filter(Boolean) };
  }
  if (parts.length === 2 && head === "audits" && id) return { name: "audit", id };
  if (parts.length === 2 && head === "shared" && id) return { name: "shared", token: id };
  return { name: "not_found" };
}

export function newAuditHref({ task, url }: { task: string; url: string }): string {
  return `/?${new URLSearchParams({ task, url })}`;
}
