import fs from "fs";

let warnedMissingCredentials = false;

function normalizePem(value: string) {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function readPemFromPath(pathValue: string | undefined, label: string) {
  if (!pathValue) {
    return null;
  }

  try {
    if (!fs.existsSync(pathValue)) {
      if (!warnedMissingCredentials) {
        console.warn(
          `[SIX] ${label} file not found at ${pathValue}. Falling back to non-mTLS mode.`
        );
        warnedMissingCredentials = true;
      }
      return null;
    }

    return fs.readFileSync(pathValue, "utf8");
  } catch {
    if (!warnedMissingCredentials) {
      console.warn(
        `[SIX] Failed to read ${label} file at ${pathValue}. Falling back to non-mTLS mode.`
      );
      warnedMissingCredentials = true;
    }
    return null;
  }
}

export function getSixMtlsCredentials() {
  const cert =
    (process.env.SIX_CERT_PEM
      ? normalizePem(process.env.SIX_CERT_PEM)
      : null) ?? readPemFromPath(process.env.SIX_CERT_PATH, "certificate");
  const key =
    (process.env.SIX_KEY_PEM
      ? normalizePem(process.env.SIX_KEY_PEM)
      : null) ?? readPemFromPath(process.env.SIX_KEY_PATH, "private key");

  if (!cert || !key) {
    return null;
  }

  return {
    cert,
    key,
    passphrase: process.env.SIX_CERT_PASSWORD,
  };
}
