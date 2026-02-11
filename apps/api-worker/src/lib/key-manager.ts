const HKDF_SALT = new TextEncoder().encode("safework2-v1");

export const KEY_VERSION = 1;

export interface KeyManager {
  readonly keyVersion: number;
  getPiiEncryptionKey(): Promise<CryptoKey>;
  getPiiHmacKey(): Promise<CryptoKey>;
  getJwtSecret(): string;
}

export interface KeyManagerEnv {
  ENCRYPTION_KEY: string;
  HMAC_SECRET: string;
  JWT_SECRET: string;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveBits(
  secret: Uint8Array,
  purpose: string,
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    secret,
    "HKDF",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info: new TextEncoder().encode(purpose),
    },
    keyMaterial,
    256,
  );
}

async function deriveAesKey(
  base64Secret: string,
  purpose: string,
): Promise<CryptoKey> {
  const secret = base64ToBytes(base64Secret);
  if (secret.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 encoded)");
  }

  const bits = await deriveBits(secret, purpose);
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function deriveHmacKey(
  secretValue: string,
  purpose: string,
): Promise<CryptoKey> {
  const secret = new TextEncoder().encode(secretValue);
  const bits = await deriveBits(secret, purpose);

  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export function createKeyManager(env: KeyManagerEnv): KeyManager {
  let piiEncryptionKeyPromise: Promise<CryptoKey> | null = null;
  let piiHmacKeyPromise: Promise<CryptoKey> | null = null;

  return {
    keyVersion: KEY_VERSION,
    getPiiEncryptionKey() {
      if (!piiEncryptionKeyPromise) {
        piiEncryptionKeyPromise = deriveAesKey(
          env.ENCRYPTION_KEY,
          "pii-encrypt",
        );
      }
      return piiEncryptionKeyPromise;
    },
    getPiiHmacKey() {
      if (!piiHmacKeyPromise) {
        piiHmacKeyPromise = deriveHmacKey(env.HMAC_SECRET, "pii-hmac");
      }
      return piiHmacKeyPromise;
    },
    getJwtSecret() {
      return env.JWT_SECRET;
    },
  };
}
