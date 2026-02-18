"use client";

import { useUnmatchedRecords } from "@/hooks/use-attendance";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@safetywallet/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

export default function UnmatchedRecordsPage() {
  const { data, isLoading } = useUnmatchedRecords();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          미매칭 기록
        </h1>
        <p className="text-muted-foreground mt-1">
          FAS 출근 데이터와 시스템 사용자가 매칭되지 않은 기록입니다
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>미매칭 목록</CardTitle>
          <CardDescription>
            아래 근로자들의 정보가 시스템에 등록되지 않았거나 불일치합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.records?.length ? (
            <p className="text-center text-muted-foreground py-8">
              미매칭 기록이 없습니다
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>외부 ID</TableHead>
                  <TableHead>현장</TableHead>
                  <TableHead>출처</TableHead>
                  <TableHead>출근 시각</TableHead>
                  <TableHead>사유</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((record) => (
                  <TableRow
                    key={record.id}
                    className="bg-yellow-50/50 dark:bg-yellow-950/10"
                  >
                    <TableCell className="font-mono text-sm">
                      {record.externalWorkerId}
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.siteName ?? "-"}
                    </TableCell>
                    <TableCell>{record.source ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(record.checkinAt).toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell>{"미등록 사용자"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
