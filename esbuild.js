const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/lokijs.ts", "src/loki-indexed-adapter.ts"],
    entryNames: "[name].min",
    outdir: "build",
    bundle: true,
    sourcemap: true,
    minifyWhitespace: true,
    minify: true,
    keepNames: true,
    format: "iife",
  })
  .catch(() => process.exit(1));
