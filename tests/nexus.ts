import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";
import type { Nexus } from "../target/types/nexus";

const { provider } = anchor;

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(input: string): Buffer {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(input).digest();
}

function randomEscrowId(): string {
  return `ESC-${Date.now()}-${Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0")}`;
}

// ═══════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════

describe("NEXUS Protocol", () => {
  const program = anchor.workspace.Nexus as Program<Nexus>;
  const payer = (provider.wallet as anchor.Wallet).payer;

  // Admin and institution keypairs
  const admin = Keypair.generate();
  const importerKeypair = Keypair.generate();
  const exporterKeypair = Keypair.generate();
  const marketMakerKeypair = Keypair.generate();

  const importerInstitutionId = "IMPORTER-BANK-001";
  const exporterInstitutionId = "EXPORTER-BANK-001";
  const mmInstitutionId = "MARKET-MAKER-001";

  let usdcMint: PublicKey;
  let settlementMint: PublicKey; // "NGNC" mock
  let importerUsdc: PublicKey;
  let exporterUsdc: PublicKey;
  let exporterSettlement: PublicKey;
  let mmSettlement: PublicKey;

  // PDAs
  let configPda: PublicKey;
  let kycRegistryPda: PublicKey;
  let importerKycPda: PublicKey;
  let exporterKycPda: PublicKey;
  let mmKycPda: PublicKey;

  const USDC_DECIMALS = 6;
  const ONE_USDC = 1_000_000; // 1 USDC in raw units
  const TRAVEL_RULE_THRESHOLD = 1_000_000_000; // 1000 USDC raw

  // ─────────────────────────────────────
  // Before All: Setup mints, fund wallets
  // ─────────────────────────────────────
  before(async () => {
    // Airdrop to all test keypairs
    await Promise.all([
      provider.connection.requestAirdrop(
        admin.publicKey,
        2 * LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        importerKeypair.publicKey,
        2 * LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        exporterKeypair.publicKey,
        2 * LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        marketMakerKeypair.publicKey,
        2 * LAMPORTS_PER_SOL
      ),
    ]);

    await sleep(1000); // wait for airdrops

    // Create USDC test mint
    usdcMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey, // mint authority
      null,
      USDC_DECIMALS
    );

    // Create settlement mint (NGNC mock)
    settlementMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      USDC_DECIMALS
    );

    // Create token accounts
    importerUsdc = await createAssociatedTokenAccount(
      provider.connection,
      payer,
      usdcMint,
      importerKeypair.publicKey
    );
    exporterUsdc = await createAssociatedTokenAccount(
      provider.connection,
      payer,
      usdcMint,
      exporterKeypair.publicKey
    );
    exporterSettlement = await createAssociatedTokenAccount(
      provider.connection,
      payer,
      settlementMint,
      exporterKeypair.publicKey
    );
    mmSettlement = await createAssociatedTokenAccount(
      provider.connection,
      payer,
      settlementMint,
      marketMakerKeypair.publicKey
    );

    // Mint USDC to importer (10,000 USDC)
    await mintTo(
      provider.connection,
      payer,
      usdcMint,
      importerUsdc,
      payer,
      10_000 * ONE_USDC
    );

    // Derive PDAs
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol-config")],
      program.programId
    );
    [kycRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-registry")],
      program.programId
    );
    [importerKycPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-record"), Buffer.from(importerInstitutionId)],
      program.programId
    );
    [exporterKycPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-record"), Buffer.from(exporterInstitutionId)],
      program.programId
    );
    [mmKycPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-record"), Buffer.from(mmInstitutionId)],
      program.programId
    );
  });

  // ─────────────────────────────────────
  // 1. Protocol Initialization
  // ─────────────────────────────────────
  describe("Protocol Initialization", () => {
    it("initializes the protocol", async () => {
      await program.methods
        .initializeProtocol(
          50, // 0.5% fee
          admin.publicKey,
          admin.publicKey // treasury = admin for tests
        )
        .accounts({
          config: configPda,
          kycRegistry: kycRegistryPda,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const config = await program.account.protocolConfig.fetch(configPda);
      assert.equal(config.admin.toBase58(), admin.publicKey.toBase58());
      assert.equal(config.feeBps, 50);
      assert.isFalse(config.isPaused);
    });
  });

  // ─────────────────────────────────────
  // 2. KYC Registration
  // ─────────────────────────────────────
  describe("KYC", () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

    it("registers importer institution (tier 1)", async () => {
      await program.methods
        .registerInstitution(
          importerInstitutionId,
          importerKeypair.publicKey,
          1, // tier
          "NG", // jurisdiction
          "VASP-IMPORTER-001",
          new BN(futureExpiry)
        )
        .accounts({
          config: configPda,
          kycRegistry: kycRegistryPda,
          kycRecord: importerKycPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const record = await program.account.kycRecord.fetch(importerKycPda);
      assert.equal(record.institutionId, importerInstitutionId);
      assert.equal(record.wallet.toBase58(), importerKeypair.publicKey.toBase58());
      assert.equal(record.kycTier, 1);
      assert.isTrue(record.isActive);
    });

    it("registers exporter institution (tier 2)", async () => {
      await program.methods
        .registerInstitution(
          exporterInstitutionId,
          exporterKeypair.publicKey,
          2, // tier
          "NG",
          "VASP-EXPORTER-001",
          new BN(futureExpiry)
        )
        .accounts({
          config: configPda,
          kycRegistry: kycRegistryPda,
          kycRecord: exporterKycPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const record = await program.account.kycRecord.fetch(exporterKycPda);
      assert.equal(record.kycTier, 2);
    });

    it("registers market maker institution (tier 3)", async () => {
      await program.methods
        .registerInstitution(
          mmInstitutionId,
          marketMakerKeypair.publicKey,
          3,
          "SG",
          "VASP-MM-001",
          new BN(futureExpiry)
        )
        .accounts({
          config: configPda,
          kycRegistry: kycRegistryPda,
          kycRecord: mmKycPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    });

    it("blocks registration from non-admin", async () => {
      const fakeInstitutionId = "FAKE-BANK";
      const [fakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("kyc-record"), Buffer.from(fakeInstitutionId)],
        program.programId
      );

      try {
        await program.methods
          .registerInstitution(
            fakeInstitutionId,
            Keypair.generate().publicKey,
            1,
            "US",
            "VASP-FAKE",
            new BN(futureExpiry)
          )
          .accounts({
            config: configPda,
            kycRegistry: kycRegistryPda,
            kycRecord: fakePda,
            admin: importerKeypair.publicKey, // wrong signer
            systemProgram: SystemProgram.programId,
          })
          .signers([importerKeypair])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: unknown) {
        assert.include(
          String(err),
          "Unauthorized",
          "Should throw Unauthorized error"
        );
      }
    });

    it("updates KYC record tier", async () => {
      const newExpiry = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600;
      await program.methods
        .updateKycRecord(importerInstitutionId, 2, new BN(newExpiry), null)
        .accounts({
          config: configPda,
          kycRecord: importerKycPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const record = await program.account.kycRecord.fetch(importerKycPda);
      assert.equal(record.kycTier, 2);
    });
  });

  // ─────────────────────────────────────
  // 3. Escrow Lifecycle
  // ─────────────────────────────────────
  describe("Escrow", () => {
    const escrowId = randomEscrowId();
    let escrowPda: PublicKey;
    let vaultPda: PublicKey;
    const depositAmount = 5_000 * ONE_USDC; // 5,000 USDC
    const futureExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const docHash = Array.from(sha256("invoice-001.pdf"));

    before(() => {
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(escrowId)],
        program.programId
      );
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(escrowId)],
        program.programId
      );
    });

    it("creates escrow with 1 document condition", async () => {
      const condition = {
        conditionType: { documentHash: {} },
        description: "Invoice document hash verification",
        documentHash: docHash,
        oracleFeed: null,
        oracleExpectedValue: null,
        deadline: null,
        isSatisfied: false,
        satisfiedAt: null,
        satisfiedBy: null,
        releaseBps: 10_000,
      };

      const travelRuleData = {
        originatorName: "Test Importer Ltd",
        originatorAccount: "ACC-001",
        beneficiaryName: "Test Exporter Ltd",
        beneficiaryAccount: "ACC-002",
        transactionReference: "PO-2024-001",
      };

      const params = {
        exporter: exporterKeypair.publicKey,
        exporterInstitutionId: exporterInstitutionId,
        settlementCurrencyMint: settlementMint,
        fxRateBandBps: 200,
        conditions: [condition],
        disputeWindowHours: 24,
        expiresAt: new BN(futureExpiry),
        sourceOfFundsHash: Array.from(sha256("export-proceeds")),
        travelRuleData,
      };

      await program.methods
        .createEscrow(
          escrowId,
          new BN(depositAmount),
          params,
          importerInstitutionId
        )
        .accounts({
          config: configPda,
          escrow: escrowPda,
          vaultTokenAccount: vaultPda,
          tokenMint: usdcMint,
          importerKyc: importerKycPda,
          exporterKyc: exporterKycPda,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([importerKeypair])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrow.escrowId, escrowId);
      assert.equal(escrow.depositAmount.toNumber(), depositAmount);
      assert.equal(escrow.conditions.length, 1);
      assert.equal(escrow.status.hasOwnProperty("created"), true);
    });

    it("funds the escrow", async () => {
      await program.methods
        .fundEscrow(escrowId, new BN(depositAmount))
        .accounts({
          escrow: escrowPda,
          importerTokenAccount: importerUsdc,
          vaultTokenAccount: vaultPda,
          tokenMint: usdcMint,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([importerKeypair])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrow.status.hasOwnProperty("funded"), true);

      const vault = await getAccount(provider.connection, vaultPda);
      assert.equal(vault.amount.toString(), depositAmount.toString());
    });

    it("rejects duplicate funding", async () => {
      try {
        await program.methods
          .fundEscrow(escrowId, new BN(depositAmount))
          .accounts({
            escrow: escrowPda,
            importerTokenAccount: importerUsdc,
            vaultTokenAccount: vaultPda,
            tokenMint: usdcMint,
            importer: importerKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([importerKeypair])
          .rpc();
        assert.fail("Should have thrown");
      } catch (err: unknown) {
        assert.include(String(err), "EscrowAlreadyFunded");
      }
    });

    // ─── Conditions ─────────────────────
    it("satisfies document hash condition with correct hash", async () => {
      const proof = {
        conditionIndex: 0,
        documentHash: docHash,
        oracleValue: null,
        approverSignatures: [],
        proofTimestamp: new BN(Math.floor(Date.now() / 1000)),
        metadataUri: "ipfs://QmTest",
      };

      await program.methods
        .submitCondition(escrowId, proof)
        .accounts({
          escrow: escrowPda,
          submitter: importerKeypair.publicKey,
        })
        .signers([importerKeypair])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPda);
      assert.isTrue(escrow.conditions[0].isSatisfied);
      assert.equal(escrow.status.hasOwnProperty("conditionsSatisfied"), true);
    });

    it("rejects condition with wrong document hash", async () => {
      const escrowId2 = randomEscrowId();
      const [escrowPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(escrowId2)],
        program.programId
      );
      const [vaultPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(escrowId2)],
        program.programId
      );

      // Create and fund a second escrow
      const futureExpiry2 = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      const condition2 = {
        conditionType: { documentHash: {} },
        description: "Invoice",
        documentHash: Array.from(sha256("correct-document")),
        oracleFeed: null,
        oracleExpectedValue: null,
        deadline: null,
        isSatisfied: false,
        satisfiedAt: null,
        satisfiedBy: null,
        releaseBps: 10_000,
      };
      const travelRuleData = {
        originatorName: "Importer",
        originatorAccount: "ACC",
        beneficiaryName: "Exporter",
        beneficiaryAccount: "ACC",
        transactionReference: "REF",
      };
      await program.methods
        .createEscrow(
          escrowId2,
          new BN(500 * ONE_USDC),
          {
            exporter: exporterKeypair.publicKey,
            exporterInstitutionId: exporterInstitutionId,
            settlementCurrencyMint: settlementMint,
            fxRateBandBps: 200,
            conditions: [condition2],
            disputeWindowHours: 24,
            expiresAt: new BN(futureExpiry2),
            sourceOfFundsHash: Array.from(sha256("funds")),
            travelRuleData,
          },
          importerInstitutionId
        )
        .accounts({
          config: configPda,
          escrow: escrowPda2,
          vaultTokenAccount: vaultPda2,
          tokenMint: usdcMint,
          importerKyc: importerKycPda,
          exporterKyc: exporterKycPda,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([importerKeypair])
        .rpc();

      await program.methods
        .fundEscrow(escrowId2, new BN(500 * ONE_USDC))
        .accounts({
          escrow: escrowPda2,
          importerTokenAccount: importerUsdc,
          vaultTokenAccount: vaultPda2,
          tokenMint: usdcMint,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([importerKeypair])
        .rpc();

      // Submit wrong hash
      const wrongProof = {
        conditionIndex: 0,
        documentHash: Array.from(sha256("wrong-document")),
        oracleValue: null,
        approverSignatures: [],
        proofTimestamp: new BN(Math.floor(Date.now() / 1000)),
        metadataUri: "",
      };

      try {
        await program.methods
          .submitCondition(escrowId2, wrongProof)
          .accounts({
            escrow: escrowPda2,
            submitter: importerKeypair.publicKey,
          })
          .signers([importerKeypair])
          .rpc();
        assert.fail("Should have thrown DocumentHashMismatch");
      } catch (err: unknown) {
        assert.include(String(err), "DocumentHashMismatch");
      }
    });
  });

  // ─────────────────────────────────────
  // 4. Disputes
  // ─────────────────────────────────────
  describe("Disputes", () => {
    const escrowId = randomEscrowId();
    let escrowPda: PublicKey;
    let vaultPda: PublicKey;
    const depositAmount = 2_000 * ONE_USDC;
    const futureExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const docHash = Array.from(sha256("dispute-test-doc"));

    before(async () => {
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(escrowId)],
        program.programId
      );
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(escrowId)],
        program.programId
      );

      // Create and fund escrow for dispute tests
      const condition = {
        conditionType: { documentHash: {} },
        description: "Test condition",
        documentHash: docHash,
        oracleFeed: null,
        oracleExpectedValue: null,
        deadline: null,
        isSatisfied: false,
        satisfiedAt: null,
        satisfiedBy: null,
        releaseBps: 10_000,
      };
      const travelRuleData = {
        originatorName: "Importer",
        originatorAccount: "ACC-D001",
        beneficiaryName: "Exporter",
        beneficiaryAccount: "ACC-D002",
        transactionReference: "DISPUTE-REF-001",
      };

      await program.methods
        .createEscrow(
          escrowId,
          new BN(depositAmount),
          {
            exporter: exporterKeypair.publicKey,
            exporterInstitutionId: exporterInstitutionId,
            settlementCurrencyMint: settlementMint,
            fxRateBandBps: 200,
            conditions: [condition],
            disputeWindowHours: 24,
            expiresAt: new BN(futureExpiry),
            sourceOfFundsHash: Array.from(sha256("dispute-funds")),
            travelRuleData,
          },
          importerInstitutionId
        )
        .accounts({
          config: configPda,
          escrow: escrowPda,
          vaultTokenAccount: vaultPda,
          tokenMint: usdcMint,
          importerKyc: importerKycPda,
          exporterKyc: exporterKycPda,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([importerKeypair])
        .rpc();

      await program.methods
        .fundEscrow(escrowId, new BN(depositAmount))
        .accounts({
          escrow: escrowPda,
          importerTokenAccount: importerUsdc,
          vaultTokenAccount: vaultPda,
          tokenMint: usdcMint,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([importerKeypair])
        .rpc();

      // Satisfy condition
      await program.methods
        .submitCondition(escrowId, {
          conditionIndex: 0,
          documentHash: docHash,
          oracleValue: null,
          approverSignatures: [],
          proofTimestamp: new BN(Math.floor(Date.now() / 1000)),
          metadataUri: "",
        })
        .accounts({
          escrow: escrowPda,
          submitter: importerKeypair.publicKey,
        })
        .signers([importerKeypair])
        .rpc();
    });

    it("importer raises dispute within window", async () => {
      await program.methods
        .disputeEscrow(escrowId, "Goods not delivered as specified")
        .accounts({
          escrow: escrowPda,
          importer: importerKeypair.publicKey,
        })
        .signers([importerKeypair])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrow.status.hasOwnProperty("inDispute"), true);
    });

    it("exporter cannot raise dispute", async () => {
      try {
        await program.methods
          .disputeEscrow(escrowId, "Trying to dispute as exporter")
          .accounts({
            escrow: escrowPda,
            importer: exporterKeypair.publicKey, // wrong signer
          })
          .signers([exporterKeypair])
          .rpc();
        assert.fail("Should have thrown");
      } catch (err: unknown) {
        assert.include(String(err), "Unauthorized");
      }
    });

    it("admin resolves dispute in importer's favor (refund)", async () => {
      await program.methods
        .resolveDispute(escrowId, { importerWins: {} })
        .accounts({
          config: configPda,
          escrow: escrowPda,
          vaultTokenAccount: vaultPda,
          importer_token_account: importerUsdc,
          tokenMint: usdcMint,
          admin: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrow.status.hasOwnProperty("refunded"), true);
    });
  });

  // ─────────────────────────────────────
  // 5. Refunds
  // ─────────────────────────────────────
  describe("Refunds", () => {
    it("rejects refund for non-expired escrow", async () => {
      const escrowId = randomEscrowId();
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(escrowId)],
        program.programId
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(escrowId)],
        program.programId
      );

      const futureExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      const travelRuleData = {
        originatorName: "Importer",
        originatorAccount: "ACC-R001",
        beneficiaryName: "Exporter",
        beneficiaryAccount: "ACC-R002",
        transactionReference: "REFUND-REF-001",
      };

      await program.methods
        .createEscrow(
          escrowId,
          new BN(100 * ONE_USDC),
          {
            exporter: exporterKeypair.publicKey,
            exporterInstitutionId: exporterInstitutionId,
            settlementCurrencyMint: settlementMint,
            fxRateBandBps: 200,
            conditions: [],
            disputeWindowHours: 0,
            expiresAt: new BN(futureExpiry),
            sourceOfFundsHash: Array.from(sha256("refund-funds")),
            travelRuleData,
          },
          importerInstitutionId
        )
        .accounts({
          config: configPda,
          escrow: escrowPda,
          vaultTokenAccount: vaultPda,
          tokenMint: usdcMint,
          importerKyc: importerKycPda,
          exporterKyc: exporterKycPda,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([importerKeypair])
        .rpc();

      await program.methods
        .fundEscrow(escrowId, new BN(100 * ONE_USDC))
        .accounts({
          escrow: escrowPda,
          importerTokenAccount: importerUsdc,
          vaultTokenAccount: vaultPda,
          tokenMint: usdcMint,
          importer: importerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([importerKeypair])
        .rpc();

      try {
        await program.methods
          .refundEscrow(escrowId)
          .accounts({
            escrow: escrowPda,
            vaultTokenAccount: vaultPda,
            importerTokenAccount: importerUsdc,
            tokenMint: usdcMint,
            importer: importerKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([importerKeypair])
          .rpc();
        assert.fail("Should have thrown InvalidTimestamp");
      } catch (err: unknown) {
        assert.include(String(err), "InvalidTimestamp");
      }
    });
  });

  // ─────────────────────────────────────
  // 6. KYC Revocation
  // ─────────────────────────────────────
  describe("KYC Revocation", () => {
    const revokeInstitutionId = "REVOKE-BANK-001";
    let revokeKycPda: PublicKey;

    before(async () => {
      [revokeKycPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("kyc-record"), Buffer.from(revokeInstitutionId)],
        program.programId
      );
      const futureExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
      const tmpKeypair = Keypair.generate();
      await provider.connection.requestAirdrop(
        tmpKeypair.publicKey,
        LAMPORTS_PER_SOL
      );
      await sleep(500);

      await program.methods
        .registerInstitution(
          revokeInstitutionId,
          tmpKeypair.publicKey,
          1,
          "US",
          "VASP-REVOKE",
          new BN(futureExpiry)
        )
        .accounts({
          config: configPda,
          kycRegistry: kycRegistryPda,
          kycRecord: revokeKycPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    });

    it("admin can revoke KYC record", async () => {
      await program.methods
        .revokeKycRecord(revokeInstitutionId)
        .accounts({
          config: configPda,
          kycRecord: revokeKycPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const record = await program.account.kycRecord.fetch(revokeKycPda);
      assert.isFalse(record.isActive);
    });

    it("revoked institution cannot create escrow", async () => {
      const revokedKeypair = Keypair.generate();
      await provider.connection.requestAirdrop(
        revokedKeypair.publicKey,
        LAMPORTS_PER_SOL
      );
      await sleep(500);

      const escrowId = randomEscrowId();
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(escrowId)],
        program.programId
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(escrowId)],
        program.programId
      );

      try {
        await program.methods
          .createEscrow(
            escrowId,
            new BN(100 * ONE_USDC),
            {
              exporter: exporterKeypair.publicKey,
              exporterInstitutionId: exporterInstitutionId,
              settlementCurrencyMint: settlementMint,
              fxRateBandBps: 200,
              conditions: [],
              disputeWindowHours: 0,
              expiresAt: new BN(
                Math.floor(Date.now() / 1000) + 7 * 24 * 3600
              ),
              sourceOfFundsHash: Array.from(sha256("funds")),
              travelRuleData: {
                originatorName: "",
                originatorAccount: "",
                beneficiaryName: "",
                beneficiaryAccount: "",
                transactionReference: "",
              },
            },
            revokeInstitutionId
          )
          .accounts({
            config: configPda,
            escrow: escrowPda,
            vaultTokenAccount: vaultPda,
            tokenMint: usdcMint,
            importerKyc: revokeKycPda,
            exporterKyc: exporterKycPda,
            importer: revokedKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([revokedKeypair])
          .rpc();
        assert.fail("Should have thrown KycRevoked");
      } catch (err: unknown) {
        assert.include(String(err), "KycRevoked");
      }
    });
  });
});
