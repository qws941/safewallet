"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { VoteCandidate, VoteResult, VotePeriod } from "@/types/vote";

export function useVoteCandidates(month: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "vote-candidates", siteId, month],
    queryFn: () =>
      apiFetch<{ candidates: VoteCandidate[] }>(
        `/admin/votes/candidates?siteId=${siteId}&month=${month}`,
      ).then((res) => res.candidates),
    enabled: !!siteId && !!month,
  });
}

export function useAddVoteCandidate() {
  const queryClient = useQueryClient();
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({ userId, month }: { userId: string; month: string }) =>
      apiFetch(`/admin/votes/candidates`, {
        method: "POST",
        body: JSON.stringify({ userId, siteId, month }),
      }),
    onSuccess: (_, { month }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "vote-candidates", siteId, month],
      });
    },
  });
}

export function useDeleteVoteCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/votes/candidates/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "vote-candidates"],
      });
    },
  });
}

export function useVoteResults(month: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "vote-results", siteId, month],
    queryFn: () =>
      apiFetch<VoteResult[]>(
        `/admin/votes/results?siteId=${siteId}&month=${month}`,
      ),
    enabled: !!siteId && !!month,
  });
}

export function useVotePeriod(month: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "vote-period", siteId, month],
    queryFn: () =>
      apiFetch<{ period: VotePeriod | null }>(
        `/admin/votes/period/${siteId}/${month}`,
      ).then((res) => res.period),
    enabled: !!siteId && !!month,
  });
}

export function useUpdateVotePeriod() {
  const queryClient = useQueryClient();
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({
      month,
      startDate,
      endDate,
    }: {
      month: string;
      startDate: string;
      endDate: string;
    }) =>
      apiFetch<{ period: VotePeriod }>(
        `/admin/votes/period/${siteId}/${month}`,
        {
          method: "PUT",
          body: JSON.stringify({ startDate, endDate }),
        },
      ),
    onSuccess: (_, { month }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "vote-period", siteId, month],
      });
    },
  });
}

export function useExportVoteResultsCsv() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return async (month: string) => {
    const { tokens } = useAuthStore.getState();
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://safework2-api.jclee.workers.dev/api";
    const res = await fetch(
      `${apiBase}/admin/votes/results?siteId=${siteId}&month=${month}&format=csv`,
      {
        headers: {
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      },
    );

    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vote-results-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
}
