"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@safetywallet/ui";
import { Download } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useMonthlyRankings, usePointsHistory } from "@/hooks/use-rewards";
import { getCurrentMonth, formatDate } from "../rewards-helpers";

export function ExportTab() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const [exportType, setExportType] = useState<"rankings" | "history">(
    "rankings",
  );
  const { data: rankings } = useMonthlyRankings(siteId ?? undefined);
  const { data: history } = usePointsHistory({
    siteId: siteId ?? undefined,
    limit: 1000,
    offset: 0,
  });

  const handleExport = useCallback(() => {
    let csv = "";
    if (exportType === "rankings") {
      csv = "순위,이름,포인트\n";
      for (const entry of rankings?.leaderboard ?? []) {
        csv += `${entry.rank},${entry.nameMasked},${entry.totalPoints}\n`;
      }
    } else {
      csv = "일시,회원,포인트,사유\n";
      for (const entry of history?.entries ?? []) {
        csv += `${formatDate(entry.createdAt)},${entry.member.user.nameMasked},${entry.amount},${entry.reason ?? ""}\n`;
      }
    }

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportType}-${getCurrentMonth()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportType, rankings, history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>내보내기</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium">내보내기 유형</span>
          <Select
            value={exportType}
            onValueChange={(v) => setExportType(v as "rankings" | "history")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rankings">월간 순위</SelectItem>
              <SelectItem value="history">지급 내역</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          CSV 다운로드
        </Button>
      </CardContent>
    </Card>
  );
}
