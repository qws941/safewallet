import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

async function importVapidKeys(publicKey: string, privateKey: string) {
  const publicKeyBytes = base64UrlToUint8Array(publicKey);
  const privateKeyBytes = base64UrlToUint8Array(privateKey);

  const pubKey = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    [],
  );

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );

  return { pubKey, privKey };
}

async function createJwtToken(
  endpoint: string,
  vapidPrivateKey: CryptoKey,
  vapidEmail: string,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: `mailto:${vapidEmail}`,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const unsignedToken = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPrivateKey,
    encoder.encode(unsignedToken),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${unsignedToken}.${sigB64}`;
}

async function sendSinglePush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  env: {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_EMAIL?: string;
  },
): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  try {
    const { privKey } = await importVapidKeys(
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );

    const jwt = await createJwtToken(
      subscription.endpoint,
      privKey,
      env.VAPID_EMAIL ?? "admin@safework2.jclee.me",
    );

    const body = JSON.stringify(payload);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      },
      body,
    });

    return response.ok || response.status === 201;
  } catch {
    return false;
  }
}

export async function sendPushToUser(
  db: ReturnType<typeof drizzle>,
  env: {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_EMAIL?: string;
  },
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;

  const subscriptions = await db
    .select({
      endpoint: schema.pushSubscriptions.endpoint,
      p256dh: schema.pushSubscriptions.p256dh,
      auth: schema.pushSubscriptions.auth,
    })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));

  let sent = 0;
  for (const sub of subscriptions) {
    const ok = await sendSinglePush(sub, payload, env);
    if (ok) sent++;
  }
  return sent;
}

export async function sendPushToSiteAdmins(
  db: ReturnType<typeof drizzle>,
  env: {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_EMAIL?: string;
  },
  siteId: string,
  payload: PushPayload,
): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;
  const adminMembers = await db
    .select({ userId: schema.siteMemberships.userId })
    .from(schema.siteMemberships)
    .where(eq(schema.siteMemberships.siteId, siteId));

  const adminUserIds = adminMembers.filter((m) => true).map((m) => m.userId);

  let sent = 0;
  for (const userId of adminUserIds) {
    sent += await sendPushToUser(db, env, userId, payload);
  }
  return sent;
}
