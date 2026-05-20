import { defineConfig } from "vitest/config";
import path from "node:path";

const EXTENSIONS_DIR = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@pi-lainforge/shared-utils": path.resolve(
        EXTENSIONS_DIR,
        "packages/shared-utils/src/index",
      ),
      "@pi-lainforge/shared-utils/*": path.resolve(
        EXTENSIONS_DIR,
        "packages/shared-utils/src/*",
      ),
    },
  },
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    testTimeout: 10000,
  },
});
