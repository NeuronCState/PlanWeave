#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distMainDir = resolve(packageRoot, "dist", "main");
const distPreloadDir = resolve(packageRoot, "dist", "preload");
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`)
]);

const commonOptions = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: true,
  sourcesContent: false,
  logLevel: "info",
  banner: {
    js: 'import { createRequire as __planweaveCreateRequire } from "node:module"; const require = __planweaveCreateRequire(import.meta.url);'
  },
  external: [
    ...nodeBuiltins,
    "electron",
    "electron-liquid-glass",
    "node-gyp-build"
  ]
};

await Promise.all([
  rm(distMainDir, { recursive: true, force: true }),
  rm(distPreloadDir, { recursive: true, force: true })
]);

await Promise.all([
  build({
    ...commonOptions,
    entryPoints: [resolve(packageRoot, "src", "main", "main.ts")],
    outfile: resolve(distMainDir, "main.js")
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(packageRoot, "src", "preload", "preload.ts")],
    outfile: resolve(distPreloadDir, "preload.js")
  })
]);
