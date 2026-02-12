import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface MonitoringSummary {
  periodMinutes: number;
  from: string;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  statusBreakdown: {
    "2xx": number;
    "4xx": number;
    "5xx": number;
  };
}

interface MetricsRow {
  bucket?: string;
  endpoint?: string;
  method?: string;
  totalRequests: number;
  totalErrors: number;
  avgDurationMs: number;
  maxDurationMs: number;
  total2xx: number;
  total4xx: number;
  total5xx: number;
}

interface MetricsResponse {
  groupBy: string;
  from: string;
  to: string;
  rows: MetricsRow[];
}

interface ErrorRow {
  endpoint: string;
  method: string;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  total5xx: number;
}

interface TopErrorsResponse {
  from: string;
  to: string;
  rows: ErrorRow[];
}

export function useMonitoringSummary(periodMinutes = 60) {
  return useQuery({
    queryKey: ["monitoring", "summary", periodMinutes],
    queryFn: () =>
      apiFetch<{ data: MonitoringSummary }>(
        `/admin/monitoring/summary?periodMinutes=${periodMinutes}`,
      ).then((res) => res.data),
    refetchInterval: 60_000,
  });
}

export function useMonitoringMetrics(
  groupBy: "time" | "endpoint" = "time",
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams({ groupBy });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery({
    queryKey: ["monitoring", "metrics", groupBy, from, to],
    queryFn: () =>
      apiFetch<{ data: MetricsResponse }>(
        `/admin/monitoring/metrics?${params}`,
      ).then((res) => res.data),
    refetchInterval: 60_000,
  });
}

export function useMonitoringTopErrors(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery({
    queryKey: ["monitoring", "top-errors", from, to],
    queryFn: () =>
      apiFetch<{ data: TopErrorsResponse }>(
        `/admin/monitoring/top-errors?${params}`,
      ).then((res) => res.data),
    refetchInterval: 60_000,
  });
}
