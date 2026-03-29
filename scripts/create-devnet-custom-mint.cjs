#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createMint } = require("@solana/spl-token");
const { Connection, Keypair } = require("@solana/web3.js");

function readKeypair(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const secretKey = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function main() {
  const code = (process.argv[2] || "").trim().toUpperCase();
  const name = (process.argv[3] || `${code} Test Coin`).trim();

  if (!/^[A-Z]{3,6}$/.test(code)) {
    throw new Error("Usage: npm run devnet:create-mint -- CODE \"Currency Name\"");
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const adminPath =
    process.env.NEXUS_ADMIN_KEYPAIR_PATH ?? "./nexus-deployer.json";
  const admin = readKeypair(adminPath);
  const connection = new Connection(rpcUrl, "confirmed");

  const outputDir = path.resolve(process.cwd(), "keys/devnet/mints");
  fs.mkdirSync(outputDir, { recursive: true });

  const mintFile = path.join(outputDir, `${code.toLowerCase()}-mint.json`);

  if (fs.existsSync(mintFile)) {
    const existing = readKeypair(mintFile);
    console.log(`${code} mint keypair already exists.`);
    console.log(`Mint address: ${existing.publicKey.toBase58()}`);
    console.log(`Env line: NEXT_PUBLIC_${code}_MINT=${existing.publicKey.toBase58()}`);
    return;
  }

  const mintKeypair = Keypair.generate();
  fs.writeFileSync(
    mintFile,
    JSON.stringify(Array.from(mintKeypair.secretKey), null, 2)
  );

  await createMint(
    connection,
    admin,
    admin.publicKey,
    null,
    6,
    mintKeypair
  );

  console.log(`Created ${name} (${code}) devnet mint.`);
  console.log(`Mint address: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`Keypair file: ${path.relative(process.cwd(), mintFile)}`);
  console.log(`Env line: NEXT_PUBLIC_${code}_MINT=${mintKeypair.publicKey.toBase58()}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Add the env line above to .env.");
  console.log("2. Add the new currency to lib/nexus/constants.ts if you want it selectable in the app.");
  console.log("3. Restart the dev server so the client picks up the new env var.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
