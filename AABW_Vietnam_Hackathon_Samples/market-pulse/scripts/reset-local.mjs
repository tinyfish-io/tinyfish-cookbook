import { existsSync, rmSync } from "fs";
const file = "./.marketpulse-local-store.json";
if (existsSync(file)) {
  rmSync(file);
  console.log("Local dev state cleared. Next `npm run dev` will start fresh.");
} else {
  console.log("Nothing to clear — already fresh.");
}
