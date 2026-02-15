"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  TrendDataPointDto,
  TrendFilterDto,
  PointsDistributionDto,
} from "@safetywallet/types";

function buildTrendParams(filter: TrendFilterDto): string {
  const params = new URLSearchParams();
  params.set("startDate", filter.startDate);
  params.set("endDate", filter.endDate);
  if (filter.siteId) {
    params.set("siteId", filter.siteId);
  }
  return params.toString();
}

export function usePostsTrend(
  startDate: string,
  endDate: string,
  siteId?: string,
) {
  return useQuery({
    queryKey: ["admin", "trends", "posts", siteId, startDate, endDate],
    queryFn: () => {
      const query = buildTrendParams({ startDate, endDate, siteId });
      return apiFetch<{ data: { trend: TrendDataPointDto[] } }>(
        `/admin/trends/posts?${query}`,
      ).then((res) => res.data.trend);
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useAttendanceTrend(
  startDate: string,
  endDate: string,
  siteId?: string,
) {
  return useQuery({
    queryKey: ["admin", "trends", "attendance", siteId, startDate, endDate],
    queryFn: () => {
      const query = buildTrendParams({ startDate, endDate, siteId });
      return apiFetch<{ data: { trend: TrendDataPointDto[] } }>(
        `/admin/trends/attendance?${query}`,
      ).then((res) => res.data.trend);
    },
    enabled: !!startDate && !!endDate,
  });
}

export function usePointsDistribution(
  startDate: string,
  endDate: string,
  siteId?: string,
) {
  return useQuery({
    queryKey: ["admin", "trends", "points", siteId, startDate, endDate],
    queryFn: () => {
      const query = buildTrendParams({ startDate, endDate, siteId });
      return apiFetch<{ data: { distribution: PointsDistributionDto[] } }>(
        `/admin/trends/points?${query}`,
      ).then((res) => res.data.distribution);
    },
    enabled: !!startDate && !!endDate,
  });
}
