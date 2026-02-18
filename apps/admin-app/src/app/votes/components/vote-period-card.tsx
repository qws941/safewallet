"use client";

import { useState, useEffect } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from "@safetywallet/ui";
import { useVotePeriod, useUpdateVotePeriod } from "@/hooks/use-votes";
import {
  epochToKstDateString,
  dateStringToKstEpoch,
  getPeriodStatus,
  PERIOD_STATUS_CONFIG,
} from "../votes-helpers";

interface VotePeriodCardProps {
  month: string;
}

export function VotePeriodCard({ month }: VotePeriodCardProps) {
  const { toast } = useToast();
  const { data: period } = useVotePeriod(month);
  const updatePeriod = useUpdateVotePeriod();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (period) {
      setStartDate(epochToKstDateString(period.startDate));
      setEndDate(epochToKstDateString(period.endDate));
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [period]);

  const handleUpdatePeriod = async () => {
    if (!startDate || !endDate) return;
    try {
      await updatePeriod.mutateAsync({
        month,
        startDate: dateStringToKstEpoch(startDate),
        endDate: dateStringToKstEpoch(endDate),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "투표 기간 저장 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  };

  const status = getPeriodStatus(period);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">투표 기간 설정</CardTitle>
        {status && (
          <Badge className={PERIOD_STATUS_CONFIG[status].className}>
            {PERIOD_STATUS_CONFIG[status].label}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-2">
            <label htmlFor="startDate" className="text-sm font-medium">
              시작일
            </label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="endDate" className="text-sm font-medium">
              종료일
            </label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button
            onClick={handleUpdatePeriod}
            disabled={updatePeriod.isPending}
          >
            {updatePeriod.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
