#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listPackage } from "@electron/asar";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
const appName = process.env.PLANWEAVE_PACKAGED_APP_PATH ?? (await resolvePackagedAppPath());
const appAsarPath = resolve(appName, "Contents", "Resources", "app.asar");
const executablePath = resolve(appName, "Contents", "MacOS", "PlanWeave");
const requiredAsarEntries = [
  "/dist/main/main.js",
  "/dist/preload/preload.js",
  "/node_modules/electron-updater",
  "/node_modules/builder-util-runtime",
  "/node_modules/debug",
  "/node_modules/ms"
];
const startupErrorPattern = /MODULE_NOT_FOUND|Cannot find module|Uncaught Exception/i;

async function resolvePackagedAppPath() {
  const releaseDir = resolve(packageRoot, "release");
  const entries = await readdir(releaseDir, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("mac"))
    .map((entry) => resolve(releaseDir, entry.name, "PlanWeave.app"))
    .sort();
  return candidates[0] ?? resolve(releaseDir, "mac-arm64", "PlanWeave.app");
}

function hasEntry(entries, requiredEntry) {
  return entries.some((entry) => entry === requiredEntry || entry.startsWith(`${requiredEntry}/`));
}

async function verifyAsarContents() {
  const entries = await listPackage(appAsarPath);
  const missing = requiredAsarEntries.filter((entry) => !hasEntry(entries, entry));
  if (missing.length > 0) {
    throw new Error(`Packaged app.asar is missing runtime entries:\n${missing.map((entry) => `- ${entry}`).join("\n")}`);
  }
}

async function smokeLaunch() {
  const smokeHome = await mkdtemp(join(tmpdir(), "planweave-packaged-smoke-home-"));
  const smokeUserData = await mkdtemp(join(tmpdir(), "planweave-packaged-smoke-user-data-"));
  const child = spawn(executablePath, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PLANWEAVE_HOME: smokeHome,
      PLANWEAVE_DESKTOP_SMOKE_USER_DATA_DIR: smokeUserData,
      PLANWEAVE_DESKTOP_STARTUP_SMOKE: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  await new Promise((resolve, reject) => {
    let settled = false;

    const finish = (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      if (startupErrorPattern.test(output)) {
        reject(new Error(`Packaged app emitted a startup module error:\n${output}`));
        return;
      }
      if (code !== null && code !== 0) {
        reject(new Error(`Packaged app exited with code ${code}:\n${output}`));
        return;
      }
      resolve();
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      if (output.includes("PLANWEAVE_DESKTOP_STARTUP_SMOKE_READY")) {
        finish(0);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
      if (startupErrorPattern.test(output)) {
        finish(1);
      }
    });

    const timeout = setTimeout(() => finish(0), 15_000);
    child.on("exit", finish);
    child.on("error", reject);
  });
}

await verifyAsarContents();
await smokeLaunch();
console.log("Packaged PlanWeave app smoke passed.");
