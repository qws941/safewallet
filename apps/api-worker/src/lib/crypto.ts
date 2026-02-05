export async function hmac(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

export async function encrypt(
  base64Key: string,
  plaintext: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextData = new TextEncoder().encode(plaintext);
  const cryptoKey = await importAesKey(base64Key, ["encrypt"]);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    plaintextData,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const tagLength = 16;
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
  const authTag = encryptedBytes.slice(encryptedBytes.length - tagLength);

  return `${bytesToBase64(iv)}:${bytesToBase64(ciphertext)}:${bytesToBase64(authTag)}`;
}

export async function decrypt(
  base64Key: string,
  encrypted: string,
): Promise<string> {
  const [ivBase64, ciphertextBase64, authTagBase64] = encrypted.split(":");
  if (!ivBase64 || !ciphertextBase64 || !authTagBase64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);
  const authTag = base64ToBytes(authTagBase64);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const cryptoKey = await importAesKey(base64Key, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    combined,
  );

  return new TextDecoder().decode(plaintext);
}
