"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api";

export interface FasSyncUserStats {
  total: number;
  fasLinked: number;
  missingPhone: number;
  deleted: number;
}

export interface FasSyncErrorCounts {
  open: number;
  resolved: number;
  ignored: number;
}

export interface FasSyncLogEntry {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string | null;
}

export interface FasSyncStatusResponse {
  fasStatus: string | null;
  lastFullSync: string | null;
  userStats: FasSyncUserStats;
  syncErrorCounts: FasSyncErrorCounts;
  recentSyncLogs: FasSyncLogEntry[];
}

export function useFasSyncStatus() {
  return useQuery({
    queryKey: ["admin", "fas-sync-status"],
    queryFn: async () => {
      try {
        return await apiFetch<FasSyncStatusResponse>("/admin/fas/sync-status");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return apiFetch<FasSyncStatusResponse>("/admin/sync-status");
        }
        throw err;
      }
    },
    refetchInterval: 30_000,
  });
}

export interface AcetimeSyncResponse {
  source: { key: string; size: number; uploaded: string; etag: string };
  sync: {
    extracted: number;
    created: number;
    updated: number;
    skipped: number;
  };
  fasCrossMatch: {
    attempted: number;
    matched: number;
    skipped: number;
    errors: number;
    available: number;
  };
}

export function useAcetimeSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AcetimeSyncResponse>("/acetime/sync-db", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fas-sync-status"] });
    },
  });
}

export interface AcetimeCrossMatchResponse {
  batch: { limit: number; processed: number };
  results: { matched: number; skipped: number; errors: number };
  matchedNames: string[];
  hasMore: boolean;
}

export function useAcetimeCrossMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) =>
      apiFetch<AcetimeCrossMatchResponse>(
        `/acetime/fas-cross-match${limit ? `?limit=${limit}` : ""}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fas-sync-status"] });
    },
  });
}

export interface FasSearchResult {
  emplCd: string;
  name: string;
  partCd: string;
  companyName: string;
  phone: string;
  socialNo: string;
  gojoCd: string;
  jijoCd: string;
  careCd: string;
  roleCd: string;
  stateFlag: string;
  entrDay: string;
  retrDay: string;
  rfid: string;
  violCnt: number;
  updatedAt: string;
  isActive: boolean;
}

export interface FasSearchResponse {
  query: { name?: string; phone?: string };
  count: number;
  results: FasSearchResult[];
}

export function useSearchFasMariadb(params: { name?: string; phone?: string }) {
  const searchParams = new URLSearchParams();
  if (params.name) searchParams.set("name", params.name);
  if (params.phone) searchParams.set("phone", params.phone);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["admin", "fas-search", params.name, params.phone],
    queryFn: () =>
      apiFetch<FasSearchResponse>(`/admin/fas/search-mariadb?${qs}`),
    enabled: !!(params.name || params.phone),
  });
}
