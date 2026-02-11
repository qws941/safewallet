import { KEY_VERSION } from "./key-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importAesKey(
  base64Key: string,
  usages: Array<"encrypt" | "decrypt">,
): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 encoded)");
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, usages);
}

// ---------------------------------------------------------------------------
// HMAC  —  accepts raw string (legacy) or derived CryptoKey
// ---------------------------------------------------------------------------

export async function hmac(
  secret: string | CryptoKey,
  data: string,
): Promise<string> {
  const messageData = new TextEncoder().encode(data);

  let key: CryptoKey;
  if (secret instanceof CryptoKey) {
    key = secret;
  } else {
    key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// AES-GCM Encrypt
//   CryptoKey  → versioned format  "v{N}:iv:ct:tag"  (base64 segments)
//   string     → legacy format     "iv:ct:tag"        (base64 segments)
// ---------------------------------------------------------------------------

export async function encrypt(
  key: string | CryptoKey,
  plaintext: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextData = new TextEncoder().encode(plaintext);

  let cryptoKey: CryptoKey;
  let versioned: boolean;
  if (key instanceof CryptoKey) {
    cryptoKey = key;
    versioned = true;
  } else {
    cryptoKey = await importAesKey(key, ["encrypt"]);
    versioned = false;
  }

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    plaintextData,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const tagLength = 16;
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
  const authTag = encryptedBytes.slice(encryptedBytes.length - tagLength);

  const payload = `${bytesToBase64(iv)}:${bytesToBase64(ciphertext)}:${bytesToBase64(authTag)}`;
  return versioned ? `v${KEY_VERSION}:${payload}` : payload;
}

// ---------------------------------------------------------------------------
// AES-GCM Decrypt  —  auto-detects versioned ("v1:…") vs legacy format
//
//   key             — primary key (CryptoKey for derived, string for legacy)
//   encrypted       — ciphertext string
//   legacyBase64Key — optional fallback key for legacy-encrypted data when
//                     the primary key is a derived CryptoKey
// ---------------------------------------------------------------------------

export async function decrypt(
  key: string | CryptoKey,
  encrypted: string,
  legacyBase64Key?: string,
): Promise<string> {
  const versionMatch = encrypted.match(/^v(\d+):/);

  let activeKey: CryptoKey;
  let payload: string;

  if (versionMatch) {
    const version = parseInt(versionMatch[1], 10);
    if (version !== KEY_VERSION) {
      throw new Error(`Unsupported key version: v${version}`);
    }
    if (!(key instanceof CryptoKey)) {
      throw new Error("Versioned ciphertext requires a derived CryptoKey");
    }
    activeKey = key;
    payload = encrypted.slice(versionMatch[0].length);
  } else {
    if (key instanceof CryptoKey) {
      if (!legacyBase64Key) {
        throw new Error(
          "Legacy ciphertext requires a base64 key string or legacyBase64Key fallback",
        );
      }
      activeKey = await importAesKey(legacyBase64Key, ["decrypt"]);
    } else {
      activeKey = await importAesKey(key, ["decrypt"]);
    }
    payload = encrypted;
  }

  const [ivBase64, ciphertextBase64, authTagBase64] = payload.split(":");
  if (!ivBase64 || !ciphertextBase64 || !authTagBase64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);
  const authTag = base64ToBytes(authTagBase64);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    activeKey,
    combined,
  );

  return new TextDecoder().decode(plaintext);
}
