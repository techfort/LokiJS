/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const esbuild = require("esbuild");
const { dtsPlugin } = require("esbuild-plugin-d.ts");

esbuild
  .build({
    entryPoints: [
      "src/lokijs.ts",
      "src/loki-indexed-adapter.ts",
      "src/incremental-indexeddb-adapter.ts",
    ],
    // entryNames: "[name].min",
    outdir: "dist",
    bundle: true,
    sourcemap: true,
    minifyWhitespace: true,
    minify: true,
    keepNames: true,
    format: "iife",
    plugins: [dtsPlugin()],
  })
  .catch(() => process.exit(1));
