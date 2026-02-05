export interface DeviceRegistrationEntry {
  userId: string;
  timestamp: string;
}

export const DEVICE_REGISTRATION_LIMIT = 3;
export const DEVICE_REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEVICE_ID_MAX_LENGTH = 128;

export function normalizeDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > DEVICE_ID_MAX_LENGTH) return null;
  return trimmed;
}

export function getDeviceRegistrationKey(deviceId: string): string {
  return `device:${deviceId}:registrations`;
}

function parseDeviceRegistrations(
  value: string | null,
): DeviceRegistrationEntry[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as DeviceRegistrationEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.userId === "string" &&
        typeof entry.timestamp === "string",
    );
  } catch {
    return [];
  }
}

function filterRecentRegistrations(
  entries: DeviceRegistrationEntry[],
  nowMs: number,
): DeviceRegistrationEntry[] {
  const threshold = nowMs - DEVICE_REGISTRATION_WINDOW_MS;
  return entries.filter((entry) => {
    const timestampMs = Date.parse(entry.timestamp);
    return !Number.isNaN(timestampMs) && timestampMs >= threshold;
  });
}

export async function loadRecentDeviceRegistrations(
  kv: KVNamespace,
  deviceId: string,
  nowMs: number,
): Promise<DeviceRegistrationEntry[]> {
  const raw = await kv.get(getDeviceRegistrationKey(deviceId));
  const parsed = parseDeviceRegistrations(raw);
  return filterRecentRegistrations(parsed, nowMs);
}

export async function checkDeviceRegistrationLimit(
  kv: KVNamespace,
  deviceId: string,
  nowMs: number,
  limit = DEVICE_REGISTRATION_LIMIT,
): Promise<{ allowed: boolean; recent: DeviceRegistrationEntry[] }> {
  const recent = await loadRecentDeviceRegistrations(kv, deviceId, nowMs);
  return { allowed: recent.length < limit, recent };
}

export async function recordDeviceRegistration(
  kv: KVNamespace,
  deviceId: string,
  userId: string,
  nowMs: number,
  recent?: DeviceRegistrationEntry[],
): Promise<DeviceRegistrationEntry[]> {
  const existing =
    recent ?? (await loadRecentDeviceRegistrations(kv, deviceId, nowMs));
  const next: DeviceRegistrationEntry[] = [
    ...existing,
    { userId, timestamp: new Date(nowMs).toISOString() },
  ];

  await kv.put(getDeviceRegistrationKey(deviceId), JSON.stringify(next), {
    expirationTtl: Math.ceil(DEVICE_REGISTRATION_WINDOW_MS / 1000),
  });

  return next;
}
