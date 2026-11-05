import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
    tasks: {
      // Never cached: a replay would report a wipe that did not happen. Env reaches only uncached tasks.
      e2e: { command: "vp run web#build && playwright test", cache: false },
      wipe: { command: "node --env-file-if-exists=.env server/src/wipe.ts", cache: false },
    },
  },
  test: {
    include: ["server/src/**/*.test.ts", "web/src/**/*.test.{ts,tsx}"],
  },
});
