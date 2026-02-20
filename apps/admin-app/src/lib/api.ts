import { useAuthStore } from "@/stores/auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { tokens, logout, setTokens } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (tokens?.accessToken) {
    headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle token refresh on 401
  if (response.status === 401 && tokens?.refreshToken) {
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (refreshResponse.ok) {
      const refreshResult = await refreshResponse.json();
      const newTokens = refreshResult.data ?? refreshResult;
      if (!newTokens?.accessToken || !newTokens?.refreshToken) {
        logout();
        throw new ApiError("Invalid refresh response", 401, "SESSION_EXPIRED");
      }
      setTokens(newTokens);
      headers["Authorization"] = `Bearer ${newTokens.accessToken}`;
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
      if (response.status === 401) {
        logout();
        throw new ApiError(
          "Session invalid after refresh",
          401,
          "SESSION_INVALID",
        );
      }
    } else {
      logout();
      throw new ApiError("Session expired", 401, "SESSION_EXPIRED");
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message || "Request failed",
      response.status,
      error.code,
    );
  }

  const json = await response.json();
  return json.data !== undefined ? json.data : json;
}
