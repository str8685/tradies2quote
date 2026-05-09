import { defineConfig } from "vitest/config";
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
  },
});
