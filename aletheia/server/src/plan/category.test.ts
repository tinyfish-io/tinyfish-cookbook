import { describe, expect, it } from "vite-plus/test";

import { inferCategory } from "./category.ts";

describe("inferCategory", () => {
  it.each([
    ["order a chicken biryani for dinner", "food_delivery"],
    ["get a large pizza delivered", "food_delivery"],
    ["buy boAt Bassheads 300C earphones", "electronics"],
    ["one USB-C charging cable", "electronics"],
    ["a 55 inch TV", "electronics"],
    ["a men's cotton t-shirt", "fashion"],
    ["running shoes size 9", "fashion"],
    ["flight from Mumbai to Delhi on 25 Nov", "travel"],
    ["a hotel in Goa for two nights", "travel"],
    ["two movie tickets for Saturday", "movies_events"],
    ["a concert ticket", "movies_events"],
    ["cheap flite to goa", "travel"],
    ["flug nach mallorca", "travel"],
    ["a music streaming plan", "music"],
    ["photo editing software", "software"],
    ["a vpn", "security"],
    ["phone plan", "telecom"],
    ["broadband deal", "telecom"],
    ["forfait mobile", "telecom"],
    ["phone case", "electronics"],
    ["noise cancelling headfones", "electronics"],
    ["comprar celular", "electronics"],
    ["konzertkarten", "movies_events"],
    ["a sofa", "home"],
  ])("reads %s as %s", (task, category) => {
    expect(inferCategory(task)).toBe(category);
  });

  it("does not guess at a task it cannot place", () => {
    expect(inferCategory("a garden gnome")).toBeNull();
  });

  it("does not match inside a longer word", () => {
    expect(inferCategory("a bagged tvisha")).toBeNull();
  });
});
