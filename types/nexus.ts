/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/nexus.json`.
 */
export type Nexus = {
  "address": "3GapkzNSKXUgtjLXh4wSuWQBA13EwQSzTRNiDwcpFBp7",
  "metadata": {
    "name": "nexus",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "NEXUS Protocol - Compliance-native programmable trade settlement and institutional FX venue on Solana"
  },
  "instructions": [
    {
      "name": "addFxLiquidity",
      "docs": [
        "Add liquidity to an FX venue pool"
      ],
      "discriminator": [
        163,
        209,
        133,
        161,
        187,
        116,
        96,
        254
      ],
      "accounts": [
        {
          "name": "fxVenue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "baseMint"
              },
              {
                "kind": "account",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "lpPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  45,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              },
              {
                "kind": "account",
                "path": "provider"
              }
            ]
          }
        },
        {
          "name": "fxVaultBase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  98,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "fxVaultQuote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "providerBaseAccount",
          "writable": true
        },
        {
          "name": "providerQuoteAccount",
          "writable": true
        },
        {
          "name": "baseMint"
        },
        {
          "name": "quoteMint"
        },
        {
          "name": "providerKyc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "providerInstitutionId"
              }
            ]
          }
        },
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amountA",
          "type": "u64"
        },
        {
          "name": "amountB",
          "type": "u64"
        },
        {
          "name": "providerInstitutionId",
          "type": "string"
        }
      ]
    },
    {
      "name": "cancelFxQuote",
      "docs": [
        "Cancel an unfilled RFQ quote"
      ],
      "discriminator": [
        251,
        38,
        58,
        211,
        50,
        246,
        181,
        225
      ],
      "accounts": [
        {
          "name": "rfqQuote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  102,
                  113,
                  45,
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "quoteId"
              }
            ]
          }
        },
        {
          "name": "marketMaker",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "quoteId",
          "type": "string"
        }
      ]
    },
    {
      "name": "checkCollateralHealth",
      "docs": [
        "Submit updated collateral price and check LTV health (admin/oracle only)"
      ],
      "discriminator": [
        174,
        138,
        175,
        192,
        62,
        78,
        69,
        36
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "adminOrOracle",
          "docs": [
            "The admin or oracle submitting the updated price. Must be the protocol admin."
          ],
          "signer": true
        },
        {
          "name": "adminKyc",
          "docs": [
            "KYC record of the admin (to satisfy compliance check structure)"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "adminInstitutionId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "currentPrice",
          "type": "i64"
        },
        {
          "name": "priceTimestamp",
          "type": "i64"
        },
        {
          "name": "adminInstitutionId",
          "type": "string"
        }
      ]
    },
    {
      "name": "createEscrow",
      "docs": [
        "Create a new escrow with trade conditions and compliance checks"
      ],
      "discriminator": [
        253,
        215,
        165,
        116,
        36,
        108,
        68,
        80
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "importerKyc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "importerInstitutionId"
              }
            ]
          }
        },
        {
          "name": "exporterKyc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "params.exporter_institution_id"
              }
            ]
          }
        },
        {
          "name": "importer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "depositAmount",
          "type": "u64"
        },
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "tradeParams"
            }
          }
        },
        {
          "name": "importerInstitutionId",
          "type": "string"
        }
      ]
    },
    {
      "name": "createLineageRecord",
      "docs": [
        "Create a fund lineage record for source-of-funds audit chain (admin only)"
      ],
      "discriminator": [
        142,
        66,
        241,
        203,
        123,
        114,
        219,
        35
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "lineageRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  110,
                  101,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "recordId"
              }
            ]
          }
        },
        {
          "name": "previousLineageRecord",
          "docs": [
            "Optional: previous lineage record for this institution (chain linkage).",
            "Pass the system program as a placeholder when there is no previous record.",
            "verified by the seeds constraint on the caller side."
          ],
          "optional": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "recordId",
          "type": "string"
        },
        {
          "name": "institutionId",
          "type": "string"
        },
        {
          "name": "escrowId",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "eventType",
          "type": {
            "defined": {
              "name": "lineageEventType"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "tokenMint",
          "type": "pubkey"
        },
        {
          "name": "sourceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "transactionSignature",
          "type": "string"
        },
        {
          "name": "attestation",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "disputeEscrow",
      "docs": [
        "Raise a dispute for an escrow (importer only, within dispute window)"
      ],
      "discriminator": [
        198,
        174,
        139,
        70,
        87,
        79,
        181,
        139
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "importer",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "executeSettlement",
      "docs": [
        "Atomically execute FX settlement: escrow release + FX swap in single transaction"
      ],
      "discriminator": [
        237,
        120,
        82,
        62,
        224,
        193,
        147,
        137
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "fxVenue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "escrow.token_mint",
                "account": "escrowAccount"
              },
              {
                "kind": "account",
                "path": "escrow.settlement_currency_mint",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "fxVaultBase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  98,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "fxVaultQuote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "exporterSettlementAccount",
          "writable": true
        },
        {
          "name": "treasuryAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "settlementMint"
        },
        {
          "name": "importerKyc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "escrow.importer_institution_id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "exporterKyc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "escrow.exporter_institution_id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "travelRuleLog",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  97,
                  118,
                  101,
                  108,
                  45,
                  114,
                  117,
                  108,
                  101,
                  45,
                  108,
                  111,
                  103
                ]
              },
              {
                "kind": "arg",
                "path": "logId"
              }
            ]
          }
        },
        {
          "name": "settler",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "logId",
          "type": "string"
        },
        {
          "name": "fxParams",
          "type": {
            "defined": {
              "name": "fxExecutionParams"
            }
          }
        },
        {
          "name": "originatorName",
          "type": "string"
        },
        {
          "name": "originatorAccount",
          "type": "string"
        },
        {
          "name": "beneficiaryName",
          "type": "string"
        },
        {
          "name": "beneficiaryAccount",
          "type": "string"
        },
        {
          "name": "transactionReference",
          "type": "string"
        },
        {
          "name": "settlementStartMs",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundEscrow",
      "docs": [
        "Fund an escrow by transferring tokens to the PDA vault"
      ],
      "discriminator": [
        155,
        18,
        218,
        141,
        182,
        213,
        69,
        201
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "importerTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "importer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundEscrowWithCollateral",
      "docs": [
        "Fund an escrow using tokenized commodity collateral (precious metals / RWA)"
      ],
      "discriminator": [
        225,
        180,
        190,
        172,
        102,
        51,
        240,
        81
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "importerCollateralAccount",
          "docs": [
            "Collateral token account owned by the importer"
          ],
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "PDA vault that holds the collateral tokens"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "importer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "collateralAmount",
          "type": "u64"
        },
        {
          "name": "sixBfiPrice",
          "type": "i64"
        },
        {
          "name": "priceTimestamp",
          "type": "i64"
        },
        {
          "name": "collateralType",
          "type": "u8"
        },
        {
          "name": "sixBfiValorBc",
          "type": "string"
        },
        {
          "name": "ltvBps",
          "type": "u16"
        },
        {
          "name": "liquidationThresholdBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeFxVenue",
      "docs": [
        "Initialize an FX venue and seed its base/quote liquidity vaults."
      ],
      "discriminator": [
        231,
        128,
        179,
        93,
        251,
        129,
        210,
        191
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fxVenue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "baseMint"
              },
              {
                "kind": "account",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "fxVaultBase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  98,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "fxVaultQuote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "adminBaseAccount",
          "writable": true
        },
        {
          "name": "adminQuoteAccount",
          "writable": true
        },
        {
          "name": "baseMint"
        },
        {
          "name": "quoteMint"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "venueId",
          "type": "string"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "sixBfiRate",
          "type": "i64"
        },
        {
          "name": "maxRateDeviationBps",
          "type": "u16"
        },
        {
          "name": "initialBaseLiquidity",
          "type": "u64"
        },
        {
          "name": "initialQuoteLiquidity",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeProtocol",
      "docs": [
        "Initialize the NEXUS protocol with admin, fee configuration, and KYC registry"
      ],
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "kycRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "admin",
          "type": "pubkey"
        },
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "liquidateCollateral",
      "docs": [
        "Liquidate collateral that has been flagged for liquidation (admin only)"
      ],
      "discriminator": [
        160,
        199,
        78,
        141,
        140,
        146,
        166,
        212
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "collateralVault",
          "docs": [
            "PDA vault holding the collateral tokens"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "Protocol treasury token account to receive liquidated collateral"
          ],
          "writable": true
        },
        {
          "name": "importerRefundAccount",
          "docs": [
            "Importer token account to receive proportional refund"
          ],
          "writable": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "admin",
          "docs": [
            "Admin must authorize liquidation"
          ],
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        }
      ]
    },
    {
      "name": "postFxQuote",
      "docs": [
        "Post an RFQ quote to the FX venue (KYC tier 2+ required)"
      ],
      "discriminator": [
        73,
        188,
        248,
        116,
        3,
        9,
        167,
        170
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fxVenue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "params.venue"
              }
            ]
          }
        },
        {
          "name": "rfqQuote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  102,
                  113,
                  45,
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "params.quote_id"
              }
            ]
          }
        },
        {
          "name": "marketMakerKyc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "marketMakerInstitutionId"
              }
            ]
          }
        },
        {
          "name": "marketMaker",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "quoteParams"
            }
          }
        },
        {
          "name": "marketMakerInstitutionId",
          "type": "string"
        }
      ]
    },
    {
      "name": "refundEscrow",
      "docs": [
        "Refund escrow after expiry"
      ],
      "discriminator": [
        107,
        186,
        89,
        99,
        26,
        194,
        23,
        204
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "importerTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "importer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerInstitution",
      "docs": [
        "Register a new institution with KYC record"
      ],
      "discriminator": [
        77,
        234,
        193,
        118,
        107,
        20,
        106,
        52
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "kycRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "kycRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "institutionId"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "institutionId",
          "type": "string"
        },
        {
          "name": "wallet",
          "type": "pubkey"
        },
        {
          "name": "kycTier",
          "type": "u8"
        },
        {
          "name": "jurisdiction",
          "type": "string"
        },
        {
          "name": "vaspId",
          "type": "string"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "removeFxLiquidity",
      "docs": [
        "Remove liquidity from an FX venue pool"
      ],
      "discriminator": [
        26,
        165,
        126,
        26,
        25,
        121,
        229,
        147
      ],
      "accounts": [
        {
          "name": "fxVenue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  101,
                  110,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "baseMint"
              },
              {
                "kind": "account",
                "path": "quoteMint"
              }
            ]
          }
        },
        {
          "name": "lpPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  45,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              },
              {
                "kind": "account",
                "path": "provider"
              }
            ]
          }
        },
        {
          "name": "fxVaultBase",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  98,
                  97,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "fxVaultQuote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  120,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "fxVenue"
              }
            ]
          }
        },
        {
          "name": "providerBaseAccount",
          "writable": true
        },
        {
          "name": "providerQuoteAccount",
          "writable": true
        },
        {
          "name": "baseMint"
        },
        {
          "name": "quoteMint"
        },
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "lpAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "docs": [
        "Resolve a dispute (admin only)"
      ],
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "importerTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "ruling",
          "type": {
            "defined": {
              "name": "disputeRuling"
            }
          }
        }
      ]
    },
    {
      "name": "revokeKycRecord",
      "docs": [
        "Revoke a KYC record (admin only)"
      ],
      "discriminator": [
        185,
        13,
        250,
        220,
        40,
        143,
        115,
        86
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "kycRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "institutionId"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "institutionId",
          "type": "string"
        }
      ]
    },
    {
      "name": "submitCondition",
      "docs": [
        "Submit proof for a condition to mark it satisfied"
      ],
      "discriminator": [
        72,
        61,
        21,
        185,
        234,
        132,
        52,
        217
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "submitter",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "string"
        },
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "conditionProof"
            }
          }
        }
      ]
    },
    {
      "name": "updateKycRecord",
      "docs": [
        "Update KYC record tier and expiry (admin only)"
      ],
      "discriminator": [
        113,
        239,
        61,
        60,
        75,
        199,
        127,
        164
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "kycRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  121,
                  99,
                  45,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "institutionId"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "institutionId",
          "type": "string"
        },
        {
          "name": "newTier",
          "type": "u8"
        },
        {
          "name": "newExpiry",
          "type": "i64"
        },
        {
          "name": "newAmlRiskScore",
          "type": {
            "option": "u8"
          }
        }
      ]
    },
    {
      "name": "verifyLineageChain",
      "docs": [
        "Verify a fund lineage chain for regulatory inspection",
        "Pass ordered chain records via remaining_accounts (oldest first)"
      ],
      "discriminator": [
        117,
        197,
        69,
        14,
        27,
        209,
        76,
        102
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "institutionId",
          "type": "string"
        },
        {
          "name": "startRecord",
          "type": "pubkey"
        },
        {
          "name": "endRecord",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrowAccount",
      "discriminator": [
        36,
        69,
        48,
        18,
        128,
        225,
        125,
        135
      ]
    },
    {
      "name": "fundLineageRecord",
      "discriminator": [
        220,
        129,
        109,
        144,
        213,
        61,
        233,
        114
      ]
    },
    {
      "name": "fxVenue",
      "discriminator": [
        245,
        242,
        101,
        90,
        177,
        101,
        225,
        8
      ]
    },
    {
      "name": "kycRecord",
      "discriminator": [
        60,
        42,
        41,
        19,
        198,
        74,
        18,
        101
      ]
    },
    {
      "name": "kycRegistry",
      "discriminator": [
        204,
        241,
        19,
        79,
        46,
        77,
        56,
        20
      ]
    },
    {
      "name": "liquidityPosition",
      "discriminator": [
        153,
        56,
        106,
        34,
        55,
        42,
        113,
        176
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      "name": "rfqQuote",
      "discriminator": [
        145,
        52,
        8,
        29,
        156,
        146,
        29,
        195
      ]
    },
    {
      "name": "travelRuleLog",
      "discriminator": [
        71,
        4,
        134,
        101,
        162,
        120,
        55,
        10
      ]
    }
  ],
  "events": [
    {
      "name": "amlFlagRaised",
      "discriminator": [
        158,
        236,
        99,
        4,
        109,
        64,
        189,
        63
      ]
    },
    {
      "name": "collateralDeposited",
      "discriminator": [
        244,
        62,
        77,
        11,
        135,
        112,
        61,
        96
      ]
    },
    {
      "name": "collateralHealthUpdated",
      "discriminator": [
        91,
        60,
        43,
        148,
        20,
        96,
        79,
        52
      ]
    },
    {
      "name": "collateralLiquidated",
      "discriminator": [
        148,
        42,
        28,
        104,
        72,
        50,
        124,
        98
      ]
    },
    {
      "name": "conditionSatisfied",
      "discriminator": [
        251,
        224,
        70,
        166,
        73,
        225,
        219,
        4
      ]
    },
    {
      "name": "disputeRaised",
      "discriminator": [
        246,
        167,
        109,
        37,
        142,
        45,
        38,
        176
      ]
    },
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "escrowCreated",
      "discriminator": [
        70,
        127,
        105,
        102,
        92,
        97,
        7,
        173
      ]
    },
    {
      "name": "escrowFunded",
      "discriminator": [
        228,
        243,
        166,
        74,
        22,
        167,
        157,
        244
      ]
    },
    {
      "name": "escrowRefunded",
      "discriminator": [
        132,
        209,
        49,
        109,
        135,
        138,
        28,
        81
      ]
    },
    {
      "name": "escrowSettled",
      "discriminator": [
        97,
        27,
        150,
        55,
        203,
        179,
        173,
        23
      ]
    },
    {
      "name": "fxQuoteFilled",
      "discriminator": [
        64,
        99,
        24,
        211,
        167,
        62,
        60,
        75
      ]
    },
    {
      "name": "fxQuotePosted",
      "discriminator": [
        59,
        98,
        127,
        57,
        21,
        142,
        220,
        1
      ]
    },
    {
      "name": "kycRegistered",
      "discriminator": [
        141,
        210,
        224,
        167,
        36,
        212,
        92,
        80
      ]
    },
    {
      "name": "kycRevoked",
      "discriminator": [
        205,
        46,
        180,
        9,
        213,
        21,
        197,
        62
      ]
    },
    {
      "name": "lineageChainVerified",
      "discriminator": [
        19,
        244,
        72,
        82,
        118,
        189,
        36,
        92
      ]
    },
    {
      "name": "lineageRecordCreated",
      "discriminator": [
        63,
        113,
        174,
        193,
        143,
        196,
        63,
        42
      ]
    },
    {
      "name": "travelRuleEmitted",
      "discriminator": [
        18,
        199,
        210,
        187,
        112,
        66,
        78,
        56
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "institutionNotKyced",
      "msg": "Institution is not KYC registered"
    },
    {
      "code": 6001,
      "name": "kycExpired",
      "msg": "KYC record has expired"
    },
    {
      "code": 6002,
      "name": "kycTierInsufficient",
      "msg": "KYC tier is insufficient for this operation"
    },
    {
      "code": 6003,
      "name": "kycRevoked",
      "msg": "KYC record has been revoked"
    },
    {
      "code": 6004,
      "name": "amlSanctionsMatch",
      "msg": "Address matches sanctions list"
    },
    {
      "code": 6005,
      "name": "amlRiskScoreTooHigh",
      "msg": "AML risk score exceeds permitted threshold"
    },
    {
      "code": 6006,
      "name": "amlCheckRequired",
      "msg": "AML check is required before proceeding"
    },
    {
      "code": 6007,
      "name": "escrowAlreadyFunded",
      "msg": "Escrow has already been funded"
    },
    {
      "code": 6008,
      "name": "escrowNotFunded",
      "msg": "Escrow has not been funded yet"
    },
    {
      "code": 6009,
      "name": "escrowAlreadySettled",
      "msg": "Escrow has already been settled"
    },
    {
      "code": 6010,
      "name": "escrowExpired",
      "msg": "Escrow has expired"
    },
    {
      "code": 6011,
      "name": "escrowInDispute",
      "msg": "Escrow is currently in dispute"
    },
    {
      "code": 6012,
      "name": "escrowNotInDispute",
      "msg": "Escrow is not in dispute"
    },
    {
      "code": 6013,
      "name": "conditionAlreadySatisfied",
      "msg": "Condition has already been satisfied"
    },
    {
      "code": 6014,
      "name": "conditionIndexOutOfBounds",
      "msg": "Condition index is out of bounds"
    },
    {
      "code": 6015,
      "name": "conditionProofInvalid",
      "msg": "Condition proof is invalid"
    },
    {
      "code": 6016,
      "name": "documentHashMismatch",
      "msg": "Document hash does not match condition requirement"
    },
    {
      "code": 6017,
      "name": "oracleValueMismatch",
      "msg": "Oracle value does not match expected condition value"
    },
    {
      "code": 6018,
      "name": "notAllConditionsSatisfied",
      "msg": "Not all conditions have been satisfied"
    },
    {
      "code": 6019,
      "name": "disputeWindowActive",
      "msg": "Dispute window is still active"
    },
    {
      "code": 6020,
      "name": "disputeWindowExpired",
      "msg": "Dispute window has expired"
    },
    {
      "code": 6021,
      "name": "unauthorizedDispute",
      "msg": "Unauthorized to raise dispute"
    },
    {
      "code": 6022,
      "name": "quoteExpired",
      "msg": "Quote has expired"
    },
    {
      "code": 6023,
      "name": "quoteAlreadyFilled",
      "msg": "Quote has already been filled"
    },
    {
      "code": 6024,
      "name": "rateOutsideBand",
      "msg": "Rate is outside permitted band"
    },
    {
      "code": 6025,
      "name": "rateDeviationExceedsSixBfi",
      "msg": "Rate deviation exceeds SIX BFI reference rate threshold"
    },
    {
      "code": 6026,
      "name": "insufficientLiquidity",
      "msg": "Insufficient liquidity in FX pool"
    },
    {
      "code": 6027,
      "name": "slippageExceeded",
      "msg": "Slippage exceeds permitted maximum"
    },
    {
      "code": 6028,
      "name": "invalidFxPair",
      "msg": "Invalid FX pair"
    },
    {
      "code": 6029,
      "name": "rateOracleUnavailable",
      "msg": "Rate oracle is unavailable"
    },
    {
      "code": 6030,
      "name": "travelRuleThresholdExceeded",
      "msg": "Transfer amount exceeds travel rule threshold but data is missing"
    },
    {
      "code": 6031,
      "name": "travelRuleDataMissing",
      "msg": "Travel rule data is missing or incomplete"
    },
    {
      "code": 6032,
      "name": "unauthorized",
      "msg": "Unauthorized operation"
    },
    {
      "code": 6033,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6034,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6035,
      "name": "invalidTimestamp",
      "msg": "Invalid timestamp"
    },
    {
      "code": 6036,
      "name": "protocolPaused",
      "msg": "Protocol is currently paused"
    },
    {
      "code": 6037,
      "name": "maxConditionsReached",
      "msg": "Maximum number of conditions reached"
    },
    {
      "code": 6038,
      "name": "venueNotActive",
      "msg": "FX venue is not active"
    },
    {
      "code": 6039,
      "name": "invalidEscrowStatus",
      "msg": "Escrow is not in the correct status for this operation"
    },
    {
      "code": 6040,
      "name": "collateralValueInsufficient",
      "msg": "Collateral USD value is insufficient to cover required LTV"
    },
    {
      "code": 6041,
      "name": "collateralLtvExceeded",
      "msg": "Current LTV exceeds liquidation threshold"
    },
    {
      "code": 6042,
      "name": "collateralPriceStale",
      "msg": "Collateral price data is stale"
    },
    {
      "code": 6043,
      "name": "collateralAlreadyLiquidated",
      "msg": "Collateral has already been liquidated"
    },
    {
      "code": 6044,
      "name": "invalidCollateralMint",
      "msg": "Invalid collateral token mint"
    },
    {
      "code": 6045,
      "name": "invalidLineageChain",
      "msg": "Invalid lineage chain: record does not link to expected previous"
    },
    {
      "code": 6046,
      "name": "lineageAttestationMissing",
      "msg": "Lineage attestation is missing (all-zero bytes)"
    }
  ],
  "types": [
    {
      "name": "amlFlagRaised",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "institutionId",
            "type": "string"
          },
          {
            "name": "riskScore",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collateralConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralType",
            "type": {
              "defined": {
                "name": "collateralType"
              }
            }
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "sixBfiValorBc",
            "type": "string"
          },
          {
            "name": "collateralPriceUsd",
            "type": "i64"
          },
          {
            "name": "collateralPriceUpdated",
            "type": "i64"
          },
          {
            "name": "ltvBps",
            "type": "u16"
          },
          {
            "name": "liquidationThresholdBps",
            "type": "u16"
          },
          {
            "name": "isLiquidated",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "collateralDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "collateralType",
            "type": "u8"
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "usdValue",
            "type": "i64"
          },
          {
            "name": "ltvBps",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collateralHealthUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "currentLtvBps",
            "type": "u16"
          },
          {
            "name": "thresholdBps",
            "type": "u16"
          },
          {
            "name": "isHealthy",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collateralLiquidated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "usdValueAtLiquidation",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collateralType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "stablecoin"
          },
          {
            "name": "tokenizedGold"
          },
          {
            "name": "tokenizedSilver"
          },
          {
            "name": "tokenizedPlatinum"
          },
          {
            "name": "commodityRwa"
          }
        ]
      }
    },
    {
      "name": "conditionProof",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "conditionIndex",
            "type": "u8"
          },
          {
            "name": "documentHash",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "oracleValue",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "approverSignatures",
            "type": {
              "vec": {
                "array": [
                  "u8",
                  64
                ]
              }
            }
          },
          {
            "name": "proofTimestamp",
            "type": "i64"
          },
          {
            "name": "metadataUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "conditionSatisfied",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "conditionIndex",
            "type": "u8"
          },
          {
            "name": "conditionType",
            "type": "u8"
          },
          {
            "name": "satisfiedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "conditionType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "documentHash"
          },
          {
            "name": "oracleConfirm"
          },
          {
            "name": "timeBased"
          },
          {
            "name": "multiSigApproval"
          },
          {
            "name": "manualApproval"
          }
        ]
      }
    },
    {
      "name": "disputeRaised",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "importer",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "ruling",
            "type": "u8"
          },
          {
            "name": "resolvedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeRuling",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "exporterWins"
          },
          {
            "name": "importerWins"
          }
        ]
      }
    },
    {
      "name": "escrowAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "importer",
            "type": "pubkey"
          },
          {
            "name": "exporter",
            "type": "pubkey"
          },
          {
            "name": "importerInstitutionId",
            "type": "string"
          },
          {
            "name": "exporterInstitutionId",
            "type": "string"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "vaultTokenAccount",
            "type": "pubkey"
          },
          {
            "name": "depositAmount",
            "type": "u64"
          },
          {
            "name": "releasedAmount",
            "type": "u64"
          },
          {
            "name": "settlementCurrencyMint",
            "type": "pubkey"
          },
          {
            "name": "fxRateBandBps",
            "type": "u16"
          },
          {
            "name": "conditions",
            "type": {
              "vec": {
                "defined": {
                  "name": "tradeCondition"
                }
              }
            }
          },
          {
            "name": "conditionsSatisfied",
            "type": "u8"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "escrowStatus"
              }
            }
          },
          {
            "name": "disputeWindowHours",
            "type": "u8"
          },
          {
            "name": "disputeRaisedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "fundedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "settledAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "travelRuleAttached",
            "type": "bool"
          },
          {
            "name": "sourceOfFundsHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "collateral",
            "type": {
              "option": {
                "defined": {
                  "name": "collateralConfig"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrowCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "importer",
            "type": "pubkey"
          },
          {
            "name": "exporter",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "conditionsCount",
            "type": "u8"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "importer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "importer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "escrowId",
            "type": "string"
          },
          {
            "name": "importer",
            "type": "pubkey"
          },
          {
            "name": "exporter",
            "type": "pubkey"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "fxRate",
            "type": "i64"
          },
          {
            "name": "settlementAmount",
            "type": "u64"
          },
          {
            "name": "settlementCurrency",
            "type": "pubkey"
          },
          {
            "name": "settlementMs",
            "type": "u64"
          },
          {
            "name": "travelRuleLog",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "funded"
          },
          {
            "name": "conditionsPartial"
          },
          {
            "name": "conditionsSatisfied"
          },
          {
            "name": "inDispute"
          },
          {
            "name": "settled"
          },
          {
            "name": "refunded"
          },
          {
            "name": "expired"
          }
        ]
      }
    },
    {
      "name": "fundLineageRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recordId",
            "docs": [
              "UUID — validated to MAX_RECORD_ID_LEN in create_lineage_record handler"
            ],
            "type": "string"
          },
          {
            "name": "institutionId",
            "docs": [
              "Validated to MAX_INSTITUTION_ID_LEN in create_lineage_record handler"
            ],
            "type": "string"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "escrow",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "eventType",
            "type": {
              "defined": {
                "name": "lineageEventType"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "sourceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "previousRecord",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "transactionSignature",
            "docs": [
              "Validated to MAX_TX_SIG_LEN in create_lineage_record handler"
            ],
            "type": "string"
          },
          {
            "name": "blockTime",
            "type": "i64"
          },
          {
            "name": "attestation",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "fxExecutionMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "rfqQuote"
          },
          {
            "name": "ammPool"
          },
          {
            "name": "bestAvailable"
          }
        ]
      }
    },
    {
      "name": "fxExecutionParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "quoteId",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "maxSlippageBps",
            "type": "u16"
          },
          {
            "name": "executionMode",
            "type": {
              "defined": {
                "name": "fxExecutionMode"
              }
            }
          }
        ]
      }
    },
    {
      "name": "fxQuoteFilled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "quoteId",
            "type": "string"
          },
          {
            "name": "filledBy",
            "type": "pubkey"
          },
          {
            "name": "fillAmount",
            "type": "u64"
          },
          {
            "name": "rate",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fxQuotePosted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "quoteId",
            "type": "string"
          },
          {
            "name": "marketMaker",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "rate",
            "type": "i64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "validUntil",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fxVenue",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "venueId",
            "type": "string"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "totalBaseLiquidity",
            "type": "u64"
          },
          {
            "name": "totalQuoteLiquidity",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "activeQuotes",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "sixBfiRate",
            "type": "i64"
          },
          {
            "name": "sixBfiUpdatedAt",
            "type": "i64"
          },
          {
            "name": "maxRateDeviationBps",
            "type": "u16"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "totalLpShares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "kycRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "institutionId",
            "type": "string"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "kycTier",
            "type": "u8"
          },
          {
            "name": "jurisdiction",
            "type": "string"
          },
          {
            "name": "verifiedAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "amlRiskScore",
            "type": "u8"
          },
          {
            "name": "lastAmlCheck",
            "type": "i64"
          },
          {
            "name": "travelRuleVaspId",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "kycRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "institutionId",
            "type": "string"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "jurisdiction",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "kycRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registryId",
            "type": "string"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "totalInstitutions",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "kycRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "institutionId",
            "type": "string"
          },
          {
            "name": "revokedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "lineageChainVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "institutionId",
            "type": "string"
          },
          {
            "name": "startRecord",
            "type": "pubkey"
          },
          {
            "name": "endRecord",
            "type": "pubkey"
          },
          {
            "name": "chainLength",
            "type": "u32"
          },
          {
            "name": "totalValue",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "lineageEventType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "initialDeposit"
          },
          {
            "name": "escrowFunding"
          },
          {
            "name": "escrowSettlement"
          },
          {
            "name": "escrowRefund"
          },
          {
            "name": "yieldAccrual"
          },
          {
            "name": "collateralDeposit"
          },
          {
            "name": "collateralReturn"
          }
        ]
      }
    },
    {
      "name": "lineageRecordCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recordId",
            "type": "string"
          },
          {
            "name": "institutionId",
            "type": "string"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "eventType",
            "type": {
              "defined": {
                "name": "lineageEventType"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "previousRecord",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "venue",
            "type": "pubkey"
          },
          {
            "name": "lpShares",
            "type": "u64"
          },
          {
            "name": "baseDeposited",
            "type": "u64"
          },
          {
            "name": "quoteDeposited",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "kycRegistry",
            "type": "pubkey"
          },
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "quoteParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "quoteId",
            "type": "string"
          },
          {
            "name": "venue",
            "type": "pubkey"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "rate",
            "type": "i64"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "quoteSide"
              }
            }
          },
          {
            "name": "validUntil",
            "type": "i64"
          },
          {
            "name": "minFillAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "quoteSide",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bid"
          },
          {
            "name": "ask"
          }
        ]
      }
    },
    {
      "name": "rfqQuote",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "quoteId",
            "type": "string"
          },
          {
            "name": "marketMaker",
            "type": "pubkey"
          },
          {
            "name": "marketMakerInstitutionId",
            "type": "string"
          },
          {
            "name": "venue",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "rate",
            "type": "i64"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "quoteSide"
              }
            }
          },
          {
            "name": "validUntil",
            "type": "i64"
          },
          {
            "name": "minFillAmount",
            "type": "u64"
          },
          {
            "name": "isFilled",
            "type": "bool"
          },
          {
            "name": "filledAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "filledBy",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tradeCondition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "conditionType",
            "type": {
              "defined": {
                "name": "conditionType"
              }
            }
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "documentHash",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          },
          {
            "name": "oracleFeed",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "oracleExpectedValue",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "deadline",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "isSatisfied",
            "type": "bool"
          },
          {
            "name": "satisfiedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "satisfiedBy",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "releaseBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "tradeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "exporter",
            "type": "pubkey"
          },
          {
            "name": "exporterInstitutionId",
            "type": "string"
          },
          {
            "name": "settlementCurrencyMint",
            "type": "pubkey"
          },
          {
            "name": "fxRateBandBps",
            "type": "u16"
          },
          {
            "name": "conditions",
            "type": {
              "vec": {
                "defined": {
                  "name": "tradeCondition"
                }
              }
            }
          },
          {
            "name": "disputeWindowHours",
            "type": "u8"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "sourceOfFundsHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "travelRuleData",
            "type": {
              "defined": {
                "name": "travelRuleData"
              }
            }
          }
        ]
      }
    },
    {
      "name": "travelRuleData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "originatorName",
            "type": "string"
          },
          {
            "name": "originatorAccount",
            "type": "string"
          },
          {
            "name": "beneficiaryName",
            "type": "string"
          },
          {
            "name": "beneficiaryAccount",
            "type": "string"
          },
          {
            "name": "transactionReference",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "travelRuleEmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "logId",
            "type": "string"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "transferAmount",
            "type": "u64"
          },
          {
            "name": "originatorInstitutionId",
            "type": "string"
          },
          {
            "name": "beneficiaryInstitutionId",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "travelRuleLog",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "logId",
            "type": "string"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "originatorInstitutionId",
            "type": "string"
          },
          {
            "name": "originatorWallet",
            "type": "pubkey"
          },
          {
            "name": "originatorName",
            "type": "string"
          },
          {
            "name": "originatorAccount",
            "type": "string"
          },
          {
            "name": "beneficiaryInstitutionId",
            "type": "string"
          },
          {
            "name": "beneficiaryWallet",
            "type": "pubkey"
          },
          {
            "name": "beneficiaryName",
            "type": "string"
          },
          {
            "name": "beneficiaryAccount",
            "type": "string"
          },
          {
            "name": "transferAmount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "transactionReference",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
