/**
 * Web Push for Cloudflare Workers (Web Crypto API only).
 * VAPID JWT (ES256/P-256), RFC 8291 payload encryption, push delivery.
 */

import { createLogger } from "./logger";

const log = createLogger("web-push");

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushMessage {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

export interface PushResult {
  success: boolean;
  statusCode: number;
  endpoint: string;
  error?: string;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

// ─── Base64url ──────────────────────────────────────────────────────────────

export function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── VAPID JWT (ES256 / P-256 ECDSA) ───────────────────────────────────────

export async function createVapidJwt(
  audience: string,
  subject: string,
  vapidPrivateKey: string,
  expSeconds: number = 12 * 60 * 60,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + expSeconds, sub: subject };

  const headerB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const payloadB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signingKey = await importEcdsaPrivateKey(
    base64urlDecode(vapidPrivateKey),
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64urlEncode(signatureBuffer)}`;
}

/**
 * Import raw P-256 private key (32 bytes) for ECDSA signing.
 * Derives public key coords via ECDH PKCS8 import+export, then re-imports as ECDSA JWK.
 */
async function importEcdsaPrivateKey(
  rawPrivateKey: Uint8Array,
): Promise<CryptoKey> {
  const { x, y } = await deriveP256PublicKey(rawPrivateKey);

  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: base64urlEncode(rawPrivateKey),
      x: base64urlEncode(x),
      y: base64urlEncode(y),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/**
 * Derive P-256 public key (x, y) from raw 32-byte private key.
 * Imports as ECDH via minimal PKCS8 DER, exports JWK to get x,y.
 */
async function deriveP256PublicKey(
  rawPrivateKey: Uint8Array,
): Promise<{ x: Uint8Array; y: Uint8Array }> {
  // Minimal PKCS8 DER for EC P-256 private key (without optional public key)
  // ASN.1: SEQUENCE { ver=0, AlgId{ecPublicKey, prime256v1}, OCTET{ECPrivateKey{ver=1, privkey}} }
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x4d, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x33, 0x30, 0x31, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  const pkcs8Der = new Uint8Array(pkcs8Prefix.length + rawPrivateKey.length);
  pkcs8Der.set(pkcs8Prefix);
  pkcs8Der.set(rawPrivateKey, pkcs8Prefix.length);

  const ecdhKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const exportedJwk = (await crypto.subtle.exportKey(
    "jwk",
    ecdhKey,
  )) as JsonWebKey;
  return {
    x: base64urlDecode(exportedJwk.x!),
    y: base64urlDecode(exportedJwk.y!),
  };
}

// ─── RFC 8291 Payload Encryption (aes128gcm) ────────────────────────────────

export async function encryptPayload(
  plaintext: string,
  clientPublicKeyB64: string,
  authSecretB64: string,
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64urlDecode(clientPublicKeyB64);
  const authSecret = base64urlDecode(authSecretB64);

  const serverKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const serverPublicKeyRaw = (await crypto.subtle.exportKey(
    "raw",
    serverKeyPair.publicKey,
  )) as ArrayBuffer;
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes as unknown as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: clientPublicKey,
    } as unknown as SubtleCryptoDeriveKeyAlgorithm,
    serverKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || client_pub || server_pub, 32)
  const ikm = await hkdfDerive(
    authSecret,
    sharedSecret,
    buildInfo("WebPush: info", clientPublicKeyBytes, serverPublicKey),
    32,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cek = await hkdfDerive(
    salt,
    ikm,
    buildCeInfo("Content-Encoding: aes128gcm"),
    16,
  );
  const nonce = await hkdfDerive(
    salt,
    ikm,
    buildCeInfo("Content-Encoding: nonce"),
    12,
  );

  // RFC 8188 Section 2: plaintext || 0x02 (record delimiter)
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const paddedPlaintext = new Uint8Array(plaintextBytes.length + 1);
  paddedPlaintext.set(plaintextBytes);
  paddedPlaintext[plaintextBytes.length] = 0x02;

  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    cekKey,
    paddedPlaintext,
  );

  // aes128gcm header: salt(16) || rs(4, big-endian) || idlen(1) || keyid(serverPubKey)
  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = serverPublicKey.length;
  header.set(serverPublicKey, 21);

  const encrypted = new Uint8Array(header.length + ciphertext.byteLength);
  encrypted.set(header, 0);
  encrypted.set(new Uint8Array(ciphertext), header.length);

  return { encrypted, serverPublicKey };
}

// "WebPush: info" || 0x00 || client_pub(65) || server_pub(65)
function buildInfo(
  label: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array,
): Uint8Array {
  const labelBytes = new TextEncoder().encode(label);
  const info = new Uint8Array(
    labelBytes.length + 1 + clientPublicKey.length + serverPublicKey.length,
  );
  info.set(labelBytes, 0);
  info[labelBytes.length] = 0x00;
  info.set(clientPublicKey, labelBytes.length + 1);
  info.set(serverPublicKey, labelBytes.length + 1 + clientPublicKey.length);
  return info;
}

// label || 0x00
function buildCeInfo(label: string): Uint8Array {
  const labelBytes = new TextEncoder().encode(label);
  const info = new Uint8Array(labelBytes.length + 1);
  info.set(labelBytes, 0);
  info[labelBytes.length] = 0x00;
  return info;
}

async function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    ikmKey,
    length * 8,
  );

  return new Uint8Array(derivedBits);
}

// ─── Push Sending ───────────────────────────────────────────────────────────

export async function sendPushNotification(
  subscription: PushSubscription,
  message: PushMessage,
  vapidKeys: VapidKeys,
  subject: string = "mailto:admin@safewallet.jclee.me",
): Promise<PushResult> {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    const jwt = await createVapidJwt(audience, subject, vapidKeys.privateKey);
    const payload = JSON.stringify(message);
    const { encrypted } = await encryptPayload(
      payload,
      subscription.keys.p256dh,
      subscription.keys.auth,
    );

    const authorization = `vapid t=${jwt}, k=${vapidKeys.publicKey}`;

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(encrypted.byteLength),
        TTL: "86400",
        Urgency: "normal",
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200) {
      return {
        success: true,
        statusCode: response.status,
        endpoint: subscription.endpoint,
      };
    }

    // 410 Gone / 404 = subscription expired — caller should remove it
    if (response.status === 410 || response.status === 404) {
      return {
        success: false,
        statusCode: response.status,
        endpoint: subscription.endpoint,
        error: "Subscription expired or invalid",
      };
    }

    const errorBody = await response.text().catch(() => "");
    return {
      success: false,
      statusCode: response.status,
      endpoint: subscription.endpoint,
      error: `Push service returned ${response.status}: ${errorBody}`.slice(
        0,
        500,
      ),
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    log.error("Failed to send push notification", {
      error: { name: e.name, message: e.message },
      metadata: { endpoint: subscription.endpoint },
    });
    return {
      success: false,
      statusCode: 0,
      endpoint: subscription.endpoint,
      error: e.message,
    };
  }
}

export async function sendPushBulk(
  subscriptions: PushSubscription[],
  message: PushMessage,
  vapidKeys: VapidKeys,
  subject?: string,
): Promise<PushResult[]> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(sub, message, vapidKeys, subject),
    ),
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      success: false,
      statusCode: 0,
      endpoint: subscriptions[i].endpoint,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export async function generateVapidKeys(): Promise<VapidKeys> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  )) as CryptoKeyPair;

  const publicKeyRaw = (await crypto.subtle.exportKey(
    "raw",
    keyPair.publicKey,
  )) as ArrayBuffer;
  const privateKeyJwk = (await crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey,
  )) as JsonWebKey;

  return {
    publicKey: base64urlEncode(publicKeyRaw),
    privateKey: privateKeyJwk.d!,
  };
}

export function shouldRemoveSubscription(result: PushResult): boolean {
  return result.statusCode === 404 || result.statusCode === 410;
}

export function isRetryableError(result: PushResult): boolean {
  return (
    result.statusCode === 429 ||
    (result.statusCode >= 500 && result.statusCode < 600)
  );
}
