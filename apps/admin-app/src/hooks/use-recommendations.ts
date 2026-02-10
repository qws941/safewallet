"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface Recommendation {
  id: string;
  siteId: string;
  siteName: string | null;
  recommenderId: string;
  recommenderName: string | null;
  recommenderCompany: string | null;
  recommendedName: string;
  tradeType: string;
  reason: string;
  recommendationDate: string;
  createdAt: string;
}

interface RecommendationListResponse {
  items: Recommendation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RecommendationStats {
  totalRecommendations: number;
  topRecommended: {
    recommendedName: string;
    tradeType: string;
    count: number;
  }[];
  dailyCounts: { date: string; count: number }[];
}

export function useRecommendations(
  page = 1,
  limit = 20,
  startDate?: string,
  endDate?: string,
) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: [
      "admin",
      "recommendations",
      siteId,
      page,
      limit,
      startDate,
      endDate,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      return apiFetch<{ data: RecommendationListResponse }>(
        `/admin/recommendations?${params}`,
      ).then((res) => res.data);
    },
    enabled: !!siteId,
  });
}

export function useRecommendationStats(startDate?: string, endDate?: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "recommendation-stats", siteId, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      return apiFetch<{ data: RecommendationStats }>(
        `/admin/recommendations/stats?${params}`,
      ).then((res) => res.data);
    },
    enabled: !!siteId,
  });
}

export function useExportRecommendations() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const tokens = useAuthStore((s) => s.tokens);

  return async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL || "https://safework2.jclee.me/api";
    const res = await fetch(
      `${API_BASE}/admin/recommendations/export?${params}`,
      {
        headers: { Authorization: `Bearer ${tokens?.accessToken}` },
      },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recommendations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
