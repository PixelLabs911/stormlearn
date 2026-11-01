/**
 * prestart.mjs — makes `npm start` self-healing.
 *
 * node_modules/ and .next/ are build artifacts: they are not part of the
 * persisted workspace, so a fresh sandbox (or a clean checkout) has the source
 * but nothing installed or compiled. Running `next start` in that state fails
 * with a confusing "could not find a production build" error.
 *
 * This hook checks for both and repairs whichever is missing, then hands over
 * to the real start script. When everything is already in place it exits
 * immediately and adds no startup cost.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const log = (...args) => console.log("[prestart]", ...args);

function run(command, args) {
  const res = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) {
    console.error(`[prestart] \`${command} ${args.join(" ")}\` failed (exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
}

// 1. Dependencies — prefer the exact lockfile install, fall back to a resolve.
const nextInstalled =
  existsSync("node_modules/next") &&
  (existsSync("node_modules/.bin/next") || existsSync("node_modules/.bin/next.cmd"));

if (!nextInstalled) {
  log("node_modules missing or incomplete — installing dependencies…");
  if (existsSync("package-lock.json")) run("npm", ["ci", "--no-audit", "--no-fund"]);
  else run("npm", ["install", "--no-audit", "--no-fund"]);
}

// 2. Production build — BUILD_ID only exists once a build has completed.
if (!existsSync(".next/BUILD_ID")) {
  log("no production build found — building…");
  run("npm", ["run", "build"]);
}

log("ready — starting the server on http://0.0.0.0:3000");
