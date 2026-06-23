import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKeyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function getTokenEncryptionKey(): Buffer | null {
  const raw = env.INTEGRATION_ENCRYPTION_KEY?.trim() || env.AUTH_SECRET?.trim();

  if (!raw) {
    return null;
  }

  const base64Key = Buffer.from(raw, "base64");
  if (base64Key.length === 32) {
    return base64Key;
  }

  const hexKey = Buffer.from(raw, "hex");
  if (hexKey.length === 32) {
    return hexKey;
  }

  return deriveKeyFromSecret(raw);
}

export function isTokenEncryptionAvailable(): boolean {
  return getTokenEncryptionKey() !== null;
}

function requireEncryptionKey(): Buffer {
  const key = getTokenEncryptionKey();

  if (!key) {
    throw new Error(
      "Token encryption is not configured. Set AUTH_SECRET or INTEGRATION_ENCRYPTION_KEY.",
    );
  }

  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const key = requireEncryptionKey();
  const payload = Buffer.from(ciphertext, "base64");

  if (payload.length <= IV_LENGTH + 16) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
