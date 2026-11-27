import { describe, expect, it } from "vite-plus/test";

import { matchRoute, newAuditHref } from "./route.ts";

describe("matchRoute", () => {
  it("opens the audit page at the root", () => {
    expect(matchRoute("/", "")).toEqual({ name: "home", task: "", url: "" });
  });

  it("reads a prefilled audit", () => {
    expect(matchRoute("/", "?task=Buy%20a%20laptop&url=https%3A%2F%2Fa.test")).toEqual({
      name: "home",
      task: "Buy a laptop",
      url: "https://a.test",
    });
  });

  it("opens past audits on their own page", () => {
    expect(matchRoute("/audits", "")).toEqual({ name: "audits" });
    expect(matchRoute("/audits/", "")).toEqual({ name: "audits" });
  });

  it("sends the old new audit address to the home page with its query", () => {
    expect(matchRoute("/new", "")).toEqual({ name: "redirect", to: "/" });
    expect(matchRoute("/new", "?task=Buy%20a%20laptop")).toEqual({
      name: "redirect",
      to: "/?task=Buy%20a%20laptop",
    });
  });

  it("finds an audit by id", () => {
    expect(matchRoute("/audits/abc-123", "")).toEqual({ name: "audit", id: "abc-123" });
  });

  it("finds a shared report by token", () => {
    expect(matchRoute("/shared/Zx_9-a", "")).toEqual({ name: "shared", token: "Zx_9-a" });
  });

  it("reads the audits to compare", () => {
    expect(matchRoute("/compare", "?audits=a1,a2")).toEqual({
      name: "compare",
      ids: ["a1", "a2"],
    });
  });

  it("tolerates a trailing slash", () => {
    expect(matchRoute("/audits/abc/", "")).toEqual({ name: "audit", id: "abc" });
  });

  it("does not guess at anything else", () => {
    expect(matchRoute("/audits/a/b", "")).toEqual({ name: "not_found" });
    expect(matchRoute("/nope", "")).toEqual({ name: "not_found" });
  });
});

describe("newAuditHref", () => {
  it("round-trips through matchRoute", () => {
    const href = newAuditHref({
      task: "Buy a laptop & bag",
      url: "https://a.test/x?y=1",
    });
    const url = new URL(href, "https://aletheia.test");
    expect(matchRoute(url.pathname, url.search)).toEqual({
      name: "home",
      task: "Buy a laptop & bag",
      url: "https://a.test/x?y=1",
    });
  });
});
