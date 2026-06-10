import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/sqlite-adapter": "src/adapters/sqlite-adapter.ts",
    "adapters/memory-adapter": "src/adapters/memory-adapter.ts",
    "adapters/semantic-adapter": "src/adapters/semantic-adapter.ts",
    "embed/types": "src/embed/types.ts",
  },
  format: ["cjs", "esm"],
  external: ["better-sqlite3"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  treeshake: true,
});
