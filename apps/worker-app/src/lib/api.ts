import { useAuthStore } from "@/stores/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  /** If true, queue the request when offline instead of throwing */
  offlineQueue?: boolean;
}

// Mutex for concurrent token refresh (prevents race conditions)
let refreshPromise: Promise<boolean> | null = null;

// ─── Offline Submission Queue ───────────────────────────────

export interface QueuedRequest {
  id: string;
  endpoint: string;
  options: { method?: string; body?: string; headers?: Record<string, string> };
  createdAt: string;
  retryCount: number;
}

const QUEUE_KEY = "safework2_offline_queue";

function getQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(endpoint: string, options: FetchOptions): void {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID(),
    endpoint,
    options: {
      method: options.method,
      body: typeof options.body === "string" ? options.body : undefined,
      headers: options.headers as Record<string, string> | undefined,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  saveQueue(queue);
}

/** Replay all queued requests. Call when coming back online. */
export async function flushOfflineQueue(): Promise<{
  succeeded: number;
  failed: number;
}> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  const remaining: QueuedRequest[] = [];

  for (const item of queue) {
    try {
      await apiFetch(item.endpoint, {
        method: item.options.method,
        body: item.options.body,
        headers: item.options.headers,
      });
      succeeded++;
    } catch {
      item.retryCount++;
      if (item.retryCount < 5) {
        remaining.push(item);
      }
      failed++;
    }
  }

  saveQueue(remaining);
  return { succeeded, failed };
}

/** Get current queue length for UI indicators */
export function getOfflineQueueLength(): number {
  return getQueue().length;
}

// Auto-flush when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushOfflineQueue();
  });
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const {
    skipAuth = false,
    offlineQueue = false,
    headers: customHeaders,
    ...rest
  } = options;

  if (offlineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(endpoint, options);
    return { success: true, data: null, queued: true } as unknown as T;
  }

  const isFormData = rest.body instanceof FormData;
  const baseHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(customHeaders as Record<string, string>),
  };

  function getHeaders(): Record<string, string> {
    const h = { ...baseHeaders };
    if (!skipAuth) {
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) {
        h["Authorization"] = `Bearer ${accessToken}`;
      }
    }
    return h;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: getHeaders(),
  });

  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...rest,
        headers: getHeaders(),
      });
      if (!retryResponse.ok) {
        throw new ApiError(retryResponse.status, await retryResponse.text());
      }
      return retryResponse.json();
    } else {
      useAuthStore.getState().logout();
      throw new ApiError(401, "Session expired");
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}

async function refreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doRefresh(): Promise<boolean> {
  const storedRefreshToken = useAuthStore.getState().refreshToken;
  if (!storedRefreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    const accessToken = data?.data?.accessToken;
    const newRefreshToken = data?.data?.refreshToken;
    if (!accessToken || !newRefreshToken) return false;

    useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
