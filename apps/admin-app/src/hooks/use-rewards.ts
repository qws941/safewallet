"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiFetch } from "./use-api-base";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  nameMasked: string;
  totalPoints: number;
  isCurrentUser: boolean;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
}

export function useMonthlyRankings(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "leaderboard", targetSiteId, "monthly"],
    queryFn: () =>
      apiFetch<LeaderboardResponse>(
        `/points/leaderboard/${targetSiteId}?type=monthly&limit=50`,
      ),
    enabled: !!targetSiteId,
  });
}

export function useAllTimeRankings(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "leaderboard", targetSiteId, "all"],
    queryFn: () =>
      apiFetch<LeaderboardResponse>(
        `/points/leaderboard/${targetSiteId}?limit=50`,
      ),
    enabled: !!targetSiteId,
  });
}

interface PointsHistoryEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  member: {
    user: {
      nameMasked: string;
    };
  };
}

interface PointsHistoryResponse {
  entries: PointsHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export function usePointsHistory(filters: {
  siteId?: string;
  limit?: number;
  offset?: number;
}) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const siteId = filters.siteId || currentSiteId;
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  return useQuery({
    queryKey: ["admin", "points-history", siteId, limit, offset],
    queryFn: () =>
      apiFetch<PointsHistoryResponse>(
        `/points/history?siteId=${siteId}&limit=${limit}&offset=${offset}`,
      ),
    enabled: !!siteId,
  });
}

export function useRevokePoints() {
  const queryClient = useQueryClient();
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({
      memberId,
      amount,
      reason,
    }: {
      memberId: string;
      amount: number;
      reason: string;
    }) =>
      apiFetch("/points/award", {
        method: "POST",
        body: JSON.stringify({
          siteId,
          memberId,
          amount: -Math.abs(amount),
          reason,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "points"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "points-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] });
    },
  });
}

export type { LeaderboardEntry, PointsHistoryEntry, PointsHistoryResponse };
