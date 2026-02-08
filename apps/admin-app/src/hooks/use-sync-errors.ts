"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export type SyncErrorStatus = "OPEN" | "RESOLVED" | "IGNORED";
export type SyncType = "FAS_ATTENDANCE" | "FAS_WORKER" | "ATTENDANCE_MANUAL";

export interface SyncErrorItem {
  id: string;
  siteId: string | null;
  syncType: SyncType;
  status: SyncErrorStatus;
  errorCode: string | null;
  errorMessage: string;
  payload: string | null;
  retryCount: number;
  lastRetryAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface SyncErrorsParams {
  status?: SyncErrorStatus;
  syncType?: SyncType;
  siteId?: string;
  limit?: number;
  offset?: number;
}

export function useSyncErrors(params: SyncErrorsParams = {}) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = params.siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "sync-errors", targetSiteId, params],
    queryFn: () => {
      const query = new URLSearchParams();
      if (params.status) query.set("status", params.status);
      if (params.syncType) query.set("syncType", params.syncType);
      if (targetSiteId) query.set("siteId", targetSiteId);
      query.set("limit", String(params.limit ?? 50));
      query.set("offset", String(params.offset ?? 0));

      return apiFetch<{ errors: SyncErrorItem[]; total: number }>(
        `/admin/sync-errors?${query.toString()}`,
      );
    },
    enabled: true,
  });
}

export function useUpdateSyncErrorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "RESOLVED" | "IGNORED";
    }) =>
      apiFetch<{ error: SyncErrorItem }>(`/admin/sync-errors/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "sync-errors"],
      });
    },
  });
}
