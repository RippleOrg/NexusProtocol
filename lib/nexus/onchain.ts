import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/nexus/constants";

const PROGRAM_PUBKEY = new PublicKey(PROGRAM_ID);

export function deriveEscrowPda(escrowId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(escrowId)],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveProtocolConfigPda(): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol-config")],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveKycRecordPda(institutionId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc-record"), Buffer.from(institutionId)],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveKycRegistryPda(): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("kyc-registry")],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveVaultPda(escrowId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(escrowId)],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveFxVenuePda(baseMint: string, quoteMint: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fx-venue"), new PublicKey(baseMint).toBuffer(), new PublicKey(quoteMint).toBuffer()],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveFxVaultBasePda(fxVenue: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fx-vault-base"), new PublicKey(fxVenue).toBuffer()],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveFxVaultQuotePda(fxVenue: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fx-vault-quote"), new PublicKey(fxVenue).toBuffer()],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveLpPositionPda(
  fxVenue: string,
  provider: string
): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("lp-position"),
      new PublicKey(fxVenue).toBuffer(),
      new PublicKey(provider).toBuffer(),
    ],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}

export function deriveTravelRuleLogPda(logId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("travel-rule-log"), Buffer.from(logId)],
    PROGRAM_PUBKEY
  );

  return pda.toBase58();
}
