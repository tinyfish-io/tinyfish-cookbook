// Renders Sumi — Kenshō's ink-fish scout — into the two 3×3 sprite sheets page-mascot expects.
//   node scripts/build-mascot.mjs   →  public/mascots/sumi-directions.png, sumi-reactions.png
// Cell order matches page-mascot: directions = up-left … down-right; reactions = blink, heart,
// sparkle, surprised, wink, bashful, sleepy, dizzy, delighted. Every cell shares one body anchor
// so the character never jumps between frames.

import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";

const C = 360; // cell size
const INK = "#0d0d0e";
const RED = "#d7261e";
const S = `stroke="${INK}" stroke-linecap="round" stroke-linejoin="round"`;

function body({ dx = 0, dy = 0 } = {}) {
  const bx = 180 + dx * 7;
  const by = 196 + dy * 5;
  return {
    bx,
    by,
    svg: `
    <ellipse cx="180" cy="326" rx="${86 - Math.abs(dx) * 4}" ry="12" fill="${INK}" opacity="0.14"/>
    <!-- tail, behind the body -->
    <path d="M${bx + 92} ${by + 6} C${bx + 128} ${by - 40} ${bx + 150} ${by - 44} ${bx + 156} ${by - 26}
             C${bx + 140} ${by - 6} ${bx + 140} ${by + 18} ${bx + 156} ${by + 40}
             C${bx + 146} ${by + 56} ${bx + 122} ${by + 50} ${bx + 92} ${by + 18} Z" fill="${INK}" ${S} stroke-width="4"/>
    <!-- dorsal fin -->
    <path d="M${bx - 30} ${by - 88} C${bx - 18} ${by - 132} ${bx + 26} ${by - 140} ${bx + 46} ${by - 112}
             C${bx + 26} ${by - 108} ${bx + 14} ${by - 98} ${bx + 10} ${by - 86} Z" fill="${INK}" ${S} stroke-width="4"/>
    <!-- side fins -->
    <path d="M${bx - 100} ${by + 22} C${bx - 132} ${by + 18} ${bx - 140} ${by + 44} ${bx - 128} ${by + 62} C${bx - 116} ${by + 50} ${bx - 104} ${by + 46} ${bx - 92} ${by + 46} Z" fill="${INK}"/>
    <path d="M${bx + 100} ${by + 30} C${bx + 128} ${by + 34} ${bx + 132} ${by + 58} ${bx + 120} ${by + 72} C${bx + 110} ${by + 60} ${bx + 100} ${by + 56} ${bx + 90} ${by + 54} Z" fill="${INK}"/>
    <!-- body -->
    <path d="M${bx - 108} ${by + 4} C${bx - 108} ${by - 64} ${bx - 56} ${by - 96} ${bx} ${by - 96}
             C${bx + 62} ${by - 96} ${bx + 108} ${by - 58} ${bx + 108} ${by + 6}
             C${bx + 108} ${by + 70} ${bx + 60} ${by + 104} ${bx} ${by + 104}
             C${bx - 62} ${by + 104} ${bx - 108} ${by + 68} ${bx - 108} ${by + 4} Z" fill="${INK}"/>
    <!-- shine + scale ticks -->
    <path d="M${bx - 78} ${by - 30} C${bx - 70} ${by - 60} ${bx - 46} ${by - 76} ${bx - 18} ${by - 80}" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M${bx + 52} ${by + 70} q8 -4 14 -12 M${bx + 66} ${by + 52} q8 -4 12 -12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.45"/>`,
  };
}

const eyePos = (bx, by, dx, dy) => [
  [bx - 40 + dx * 9, by - 4 + dy * 8],
  [bx + 40 + dx * 9, by - 4 + dy * 8],
];

function openEye([x, y], px, py, { big = false, small = false } = {}) {
  const rx = big ? 36 : 31;
  const ry = big ? 42 : 37;
  const pr = small ? 9 : 19;
  return `
    <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/>
    <circle cx="${x + px}" cy="${y + py}" r="${pr}" fill="${INK}"/>
    ${small ? "" : `<circle cx="${x + px - 6}" cy="${y + py - 8}" r="6.5" fill="#fff"/><circle cx="${x + px + 7}" cy="${y + py + 7}" r="3" fill="#fff"/>`}`;
}

const closedEye = ([x, y], up = true) =>
  up
    ? `<path d="M${x - 24} ${y + 8} Q${x} ${y - 22} ${x + 24} ${y + 8}" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>`
    : `<path d="M${x - 24} ${y - 2} Q${x} ${y + 18} ${x + 24} ${y - 2}" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>`;

const mouth = (bx, by, kind, dx = 0, dy = 0) => {
  const x = bx + dx * 9;
  const y = by + 58 + dy * 6;
  switch (kind) {
    case "o":
      return `<ellipse cx="${x}" cy="${y + 4}" rx="10" ry="13" fill="#fff"/>`;
    case "open":
      return `<path d="M${x - 22} ${y - 4} Q${x} ${y + 30} ${x + 22} ${y - 4} Z" fill="#fff"/><path d="M${x - 10} ${y + 10} Q${x} ${y + 4} ${x + 10} ${y + 10} Q${x} ${y + 18} ${x - 10} ${y + 10}" fill="${RED}"/>`;
    case "wave":
      return `<path d="M${x - 18} ${y + 4} q6 -8 12 0 t12 0 t12 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case "flat":
      return `<path d="M${x - 10} ${y + 4} L${x + 10} ${y + 4}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;
    default:
      return `<path d="M${x - 14} ${y} Q${x} ${y + 14} ${x + 14} ${y}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
};

const star = (x, y, r, fill = INK) =>
  `<path d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z" fill="${fill}"/>`;

const spiral = ([x, y]) =>
  `<ellipse cx="${x}" cy="${y}" rx="31" ry="37" fill="#fff"/><path d="M${x} ${y} m0 -4 a4 4 0 1 1 -4 4 a9 9 0 1 1 9 9 a15 15 0 1 1 -15 -15 a21 21 0 1 1 21 21" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;

function directionCell(dx, dy) {
  const { bx, by, svg } = body({ dx, dy });
  const eyes = eyePos(bx, by, dx, dy);
  return `${svg}${eyes.map((e) => openEye(e, dx * 11, dy * 12)).join("")}${mouth(bx, by, "smile", dx, dy)}`;
}

function reactionCell(kind) {
  const { bx, by, svg } = body();
  const eyes = eyePos(bx, by, 0, 0);
  const blush = `<g stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.85">${[0, 10, 20]
    .map((d) => `<path d="M${bx - 86 + d} ${by + 38} l-5 10"/><path d="M${bx + 66 + d} ${by + 38} l-5 10"/>`)
    .join("")}</g>`;
  switch (kind) {
    case "blink":
      return `${svg}${eyes.map((e) => closedEye(e, false)).join("")}${mouth(bx, by, "smile")}`;
    case "heart":
      return `${svg}${eyes.map((e) => closedEye(e)).join("")}${mouth(bx, by, "smile")}${blush}
        <path d="M${bx} ${by - 128} C${bx - 34} ${by - 160} ${bx - 50} ${by - 118} ${bx} ${by - 92} C${bx + 50} ${by - 118} ${bx + 34} ${by - 160} ${bx} ${by - 128} Z" fill="${RED}" stroke="${INK}" stroke-width="5"/>`;
    case "sparkle":
      return `${svg}${eyes
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="36" ry="42" fill="#fff"/><circle cx="${x}" cy="${y + 2}" r="22" fill="${INK}"/>${star(x - 4, y - 4, 13, "#fff")}<circle cx="${x + 9}" cy="${y + 11}" r="3.5" fill="#fff"/>`)
        .join("")}${mouth(bx, by, "open")}${star(bx - 122, by - 104, 18)}${star(bx + 128, by - 84, 13)}${star(bx + 98, by - 128, 9)}`;
    case "surprised":
      return `${svg}${eyes.map((e) => openEye(e, 0, 0, { big: true, small: true })).join("")}${mouth(bx, by, "o")}
        <g ${S} stroke-width="7"><path d="M${bx - 130} ${by - 92} l-20 -18 M${bx - 140} ${by - 56} l-26 -4 M${bx + 130} ${by - 92} l20 -18 M${bx + 140} ${by - 56} l26 -4"/></g>`;
    case "wink":
      return `${svg}${closedEye(eyes[0])}${openEye(eyes[1], 0, 0)}${mouth(bx, by, "open")}${star(bx + 112, by - 110, 12)}`;
    case "bashful":
      return `${svg}${eyes.map((e) => openEye(e, -4, 14)).join("")}${blush}${mouth(bx, by, "wave")}
        <path d="M${bx + 120} ${by - 64} q12 16 0 26 q-12 -10 0 -26 Z" fill="#fff" ${S} stroke-width="4"/>`;
    case "sleepy":
      return `${svg}${eyes.map(([x, y]) => `<path d="M${x - 24} ${y + 4} L${x + 24} ${y + 4}" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`).join("")}${mouth(bx, by, "flat")}
        <g font-family="Arial Black, Arial, sans-serif" font-weight="900" fill="${INK}"><text x="${bx + 92}" y="${by - 104}" font-size="40">Z</text><text x="${bx + 128}" y="${by - 136}" font-size="30">z</text><text x="${bx + 152}" y="${by - 160}" font-size="22">z</text></g>`;
    case "dizzy":
      return `${svg}${eyes.map(spiral).join("")}${mouth(bx, by, "wave")}
        ${star(bx - 70, by - 128, 12)}${star(bx, by - 146, 10)}${star(bx + 70, by - 128, 12)}`;
    case "delighted":
      return `${svg}${eyes.map((e) => closedEye(e)).join("")}${mouth(bx, by, "open")}${blush}
        <g ${S} stroke-width="6"><path d="M${bx - 132} ${by - 70} l-18 -12 M${bx + 132} ${by - 70} l18 -12 M${bx - 120} ${by - 112} l-10 -18 M${bx + 120} ${by - 112} l10 -18"/></g>`;
  }
  throw new Error(kind);
}

function sheet(cells) {
  const inner = cells
    .map((content, i) => `<g transform="translate(${(i % 3) * C} ${Math.floor(i / 3) * C})"><svg width="${C}" height="${C}" viewBox="0 0 ${C} ${C}">${content}</svg></g>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${C * 3}" height="${C * 3}" viewBox="0 0 ${C * 3} ${C * 3}">${inner}</svg>`;
}

const DIRS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];
const REACTIONS = ["blink", "heart", "sparkle", "surprised", "wink", "bashful", "sleepy", "dizzy", "delighted"];

mkdirSync("public/mascots", { recursive: true });
for (const [name, cells] of [
  ["directions", DIRS.map(([dx, dy]) => directionCell(dx, dy))],
  ["reactions", REACTIONS.map(reactionCell)],
]) {
  const png = new Resvg(sheet(cells), { fitTo: { mode: "width", value: 720 }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(`public/mascots/sumi-${name}.png`, png);
  console.log(`public/mascots/sumi-${name}.png`, `${Math.round(png.length / 1024)} KB`);
}
