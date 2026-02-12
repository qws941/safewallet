"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@safetywallet/ui";
import {
  Activity,
  AlertTriangle,
  Clock,
  Server,
  Zap,
  TrendingUp,
  Shield,
} from "lucide-react";
import {
  useMonitoringSummary,
  useMonitoringMetrics,
  useMonitoringTopErrors,
} from "@/hooks/use-monitoring-api";

const PERIOD_OPTIONS = [
  { value: "60", label: "최근 1시간" },
  { value: "360", label: "최근 6시간" },
  { value: "1440", label: "최근 24시간" },
  { value: "10080", label: "최근 7일" },
];

function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(bucket: string): string {
  const d = new Date(bucket);
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function getErrorRateColor(rate: number): string {
  if (rate >= 10) return "text-red-600";
  if (rate >= 5) return "text-orange-500";
  if (rate >= 1) return "text-yellow-500";
  return "text-green-600";
}

function getErrorRateBadge(rate: number) {
  if (rate >= 10) return "destructive" as const;
  if (rate >= 5) return "secondary" as const;
  return "outline" as const;
}

export default function MonitoringPage() {
  const [period, setPeriod] = useState("60");
  const periodMinutes = Number(period);

  const from = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - periodMinutes);
    return d.toISOString();
  }, [periodMinutes]);

  const { data: summary, isLoading: summaryLoading } =
    useMonitoringSummary(periodMinutes);

  const { data: timeMetrics, isLoading: timeLoading } = useMonitoringMetrics(
    "time",
    from,
  );

  const { data: endpointMetrics, isLoading: endpointLoading } =
    useMonitoringMetrics("endpoint", from);

  const { data: topErrors, isLoading: errorsLoading } =
    useMonitoringTopErrors(from);

  const maxRequests = useMemo(() => {
    if (!timeMetrics?.rows?.length) return 1;
    return Math.max(...timeMetrics.rows.map((r) => r.totalRequests), 1);
  }, [timeMetrics]);

  const maxEndpointRequests = useMemo(() => {
    if (!endpointMetrics?.rows?.length) return 1;
    return Math.max(...endpointMetrics.rows.map((r) => r.totalRequests), 1);
  }, [endpointMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            운영 모니터링
          </h1>
          <p className="text-muted-foreground mt-1">
            API 성능 및 에러율 실시간 모니터링
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>총 요청 수</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Server className="h-8 w-8 text-blue-500" />
                <span className="text-3xl font-bold">
                  {summary.totalRequests.toLocaleString()}
                </span>
                <span className="text-muted-foreground">건</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>에러율</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-8 w-8 ${getErrorRateColor(summary.errorRate)}`}
                />
                <span
                  className={`text-3xl font-bold ${getErrorRateColor(summary.errorRate)}`}
                >
                  {summary.errorRate.toFixed(1)}
                </span>
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                에러 {summary.totalErrors.toLocaleString()}건
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>평균 응답 시간</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="h-8 w-8 text-green-500" />
                <span className="text-3xl font-bold">
                  {formatDuration(summary.avgDurationMs)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                최대 {formatDuration(summary.maxDurationMs)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>상태 코드 분포</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-purple-500" />
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-green-600">
                    2xx: {summary.statusBreakdown["2xx"]}
                  </Badge>
                  <Badge variant="outline" className="text-yellow-600">
                    4xx: {summary.statusBreakdown["4xx"]}
                  </Badge>
                  <Badge variant="outline" className="text-red-600">
                    5xx: {summary.statusBreakdown["5xx"]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Time Series */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            요청 추이
          </CardTitle>
          <CardDescription>시간대별 API 요청 수 및 에러율</CardDescription>
        </CardHeader>
        <CardContent>
          {timeLoading ? (
            <Skeleton className="h-48" />
          ) : timeMetrics?.rows?.length ? (
            <div className="space-y-1">
              {timeMetrics.rows.map((row) => {
                const errorPct =
                  row.totalRequests > 0
                    ? (row.totalErrors / row.totalRequests) * 100
                    : 0;
                return (
                  <div key={row.bucket} className="flex items-center gap-3">
                    <span className="text-xs w-12 shrink-0 text-muted-foreground font-mono">
                      {formatTime(row.bucket ?? "")}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden relative">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{
                          width: `${(row.totalRequests / maxRequests) * 100}%`,
                        }}
                      />
                      {errorPct > 0 && (
                        <div
                          className="bg-red-500 h-full rounded-full absolute top-0 left-0"
                          style={{
                            width: `${(row.totalErrors / maxRequests) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <span className="text-xs w-16 text-right font-mono">
                      {row.totalRequests}
                    </span>
                    {errorPct > 0 && (
                      <Badge
                        variant={getErrorRateBadge(errorPct)}
                        className="text-xs"
                      >
                        {errorPct.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  요청
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  에러
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              해당 기간에 수집된 메트릭이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              엔드포인트별 요청
            </CardTitle>
            <CardDescription>
              API 엔드포인트별 요청 수 및 응답 시간
            </CardDescription>
          </CardHeader>
          <CardContent>
            {endpointLoading ? (
              <Skeleton className="h-48" />
            ) : endpointMetrics?.rows?.length ? (
              <div className="space-y-2">
                {endpointMetrics.rows
                  .sort((a, b) => b.totalRequests - a.totalRequests)
                  .slice(0, 15)
                  .map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs w-14 justify-center shrink-0"
                      >
                        {row.method}
                      </Badge>
                      <span className="text-xs truncate w-40 shrink-0 font-mono">
                        {row.endpoint}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{
                            width: `${(row.totalRequests / maxEndpointRequests) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs w-10 text-right font-mono">
                        {row.totalRequests}
                      </span>
                      <span className="text-xs w-16 text-right text-muted-foreground">
                        {formatDuration(row.avgDurationMs)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                데이터 없음
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Error Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              에러 상위 엔드포인트
            </CardTitle>
            <CardDescription>에러율이 높은 API 엔드포인트</CardDescription>
          </CardHeader>
          <CardContent>
            {errorsLoading ? (
              <Skeleton className="h-48" />
            ) : topErrors?.rows?.length ? (
              <div className="space-y-3">
                {topErrors.rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {row.method}
                      </Badge>
                      <span className="text-sm font-mono truncate">
                        {row.endpoint}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {row.totalRequests}건
                      </span>
                      <Badge variant={getErrorRateBadge(row.errorRate)}>
                        {row.errorRate.toFixed(1)}%
                      </Badge>
                      {row.total5xx > 0 && (
                        <span className="text-xs text-red-600 font-medium">
                          5xx: {row.total5xx}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Shield className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  에러가 감지되지 않았습니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
