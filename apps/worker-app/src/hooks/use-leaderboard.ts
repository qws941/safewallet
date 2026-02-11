import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nameMasked: string;
  totalPoints: number;
  isCurrentUser: boolean;
}

export function useLeaderboard(
  siteId: string | null,
  type: "monthly" | "cumulative" = "cumulative",
) {
  return useQuery({
    queryKey: ["leaderboard", siteId, type],
    queryFn: async () => {
      const params = type === "monthly" ? "?type=monthly" : "";
      const res = await apiFetch<{
        data: { leaderboard: LeaderboardEntry[]; myRank: number | null };
      }>(`/points/leaderboard/${siteId}${params}`);
      return res.data;
    },
    enabled: !!siteId,
  });
}
