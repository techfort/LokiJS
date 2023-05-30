const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/lokijs.ts", "src/loki-indexed-adapter.js"],
    entryNames: "[name].min",
    outdir: "build",
    // bundle: true,
    // sourcemap: true,
    minifyWhitespace: true,
    // target: ["esnext"],
  })
  .catch(() => process.exit(1));
