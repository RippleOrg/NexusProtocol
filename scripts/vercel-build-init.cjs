#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const isVercelBuild = process.env.VERCEL === "1";
const forceInit = process.env.NEXUS_RUN_BUILD_INIT === "true";

if (!isVercelBuild && !forceInit) {
  console.log("[build-init] Skipping build initialization outside Vercel.");
  process.exit(0);
}

console.log("[build-init] Starting Vercel build initialization.");

if (process.env.SKIP_BUILD_DB_INIT !== "true" && process.env.DATABASE_URL) {
  console.log("[build-init] Running Prisma deploy migrations.");
  run(
    path.join(process.cwd(), "node_modules", ".bin", "prisma"),
    ["migrate", "deploy"]
  );
} else {
  console.log("[build-init] Skipping Prisma deploy.");
}

if (process.env.NEXUS_RUN_DEVNET_SEED_ON_BUILD === "true") {
  console.log("[build-init] Running devnet seed.");
  run(process.execPath, [path.join(process.cwd(), "scripts", "seed-devnet.cjs")]);
} else {
  console.log("[build-init] Skipping devnet seed.");
}
