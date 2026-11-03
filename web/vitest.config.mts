import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      /*
       * `server-only` exists to make a build fail if a server module is pulled
       * into a client bundle. Under Vitest there is no such boundary, and its
       * main entry throws on import, so it is aliased to the package's own
       * no-op build. The protection it provides in `next build` is unaffected.
       */
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
