'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@safetywallet/ui';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Clock, Users, CheckCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  checkinAt: string;
  externalWorkerId: string;
  user: {
    id: string;
    name: string | null;
    nameMasked: string | null;
    companyName: string | null;
    tradeType: string | null;
  } | null;
}

export const runtime = 'edge';

export default function AttendancePage() {
  const [siteId] = useState<string | null>(null);

  const { data: attendanceList, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'today', siteId],
    queryFn: async () => {
      const res = await apiFetch<{ data: AttendanceRecord[] }>(`/attendance/today/list?siteId=${siteId}`);
      return res.data;
    },
    enabled: !!siteId,
    refetchInterval: 30000,
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">출근 현황</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">오늘 출근</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceList?.length || 0}명</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">첫 출근</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceList && attendanceList.length > 0
                ? formatTime(attendanceList[0].checkinAt)
                : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">마지막 출근</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceList && attendanceList.length > 0
                ? formatTime(attendanceList[attendanceList.length - 1].checkinAt)
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>출근 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {!siteId ? (
            <p className="text-muted-foreground text-center py-8">현장을 선택해주세요.</p>
          ) : isLoading ? (
            <p className="text-center py-8">로딩 중...</p>
          ) : attendanceList && attendanceList.length > 0 ? (
            <div className="space-y-2">
              {attendanceList.map((record, index) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-6">{index + 1}</span>
                    <div>
                      <p className="font-medium">
                        {record.user?.nameMasked || record.user?.name || record.externalWorkerId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {record.user?.companyName}
                        {record.user?.tradeType && ` · ${record.user.tradeType}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatTime(record.checkinAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">오늘 출근 기록이 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
