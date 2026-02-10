"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface StatsData {
  totalUsers: number;
  totalSites: number;
  totalPosts: number;
  activeUsersToday: number;
  pendingCount: number;
  urgentCount: number;
  avgProcessingHours: number;
  categoryDistribution: Record<string, number>;
  todayPostsCount: number;
}

export function useStats() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "stats", siteId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      return apiFetch<{ data: StatsData }>(`/admin/stats?${params}`).then(
        (res) => res.data,
      );
    },
    enabled: !!siteId,
  });
}
