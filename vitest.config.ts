import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Vitest runs in Node; the Next.js client-only `server-only` guard would
    // throw outside a build. Stub it for tests so server-side libs can be
    // unit-tested directly.
    alias: {
      "server-only": resolve(__dirname, "src/test/server-only-stub.ts"),
      "@": resolve(__dirname, "src"),
    },
    // `.claude/worktrees/` holds full git-worktree copies of the repo.
    // Without this exclude, vitest globs their test files too and runs
    // the whole suite once per worktree — several times slower, and any
    // failure shows up duplicated per copy. Spread the vitest defaults
    // so node_modules / dist / config-file exclusions aren't dropped.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
});
