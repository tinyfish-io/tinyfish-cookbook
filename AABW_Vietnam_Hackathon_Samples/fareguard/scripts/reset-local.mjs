// Wipes local dev state so the next `npm run dev` behaves like a brand new
// install — no booking requests, no price history, and a sweep has "never
// run", so the first page load fires the bootstrap sweep again. Use this
// whenever you want to retest the first-open behavior from scratch.
import { existsSync, rmSync } from "fs";

const file = "./.fareguard-local-store.json";
if (existsSync(file)) {
  rmSync(file);
  console.log("Local dev state cleared. Next `npm run dev` will start fresh.");
} else {
  console.log("Nothing to clear — already fresh.");
}
