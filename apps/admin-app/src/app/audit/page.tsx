"use client";

import { DataTable, type Column } from "@/components/data-table";
import { useAuditLogs, type AuditLog } from "@/hooks/use-api";

const actionLabels: Record<string, string> = {
  POST_REVIEWED: "제보 검토",
  ROLE_CHANGE: "역할 변경",
  LOGIN_LOCKOUT: "로그인 잠금",
  LOGIN_LOCKOUT_RESET: "로그인 잠금 해제",
  DEVICE_REGISTRATION: "기기 등록",
  FAS_SYNC_COMPLETED: "FAS 동기화 완료",
  FAS_SYNC_FAILED: "FAS 동기화 실패",
  FAS_WORKERS_SYNCED: "FAS 근로자 동기화",
  FAS_WORKER_DELETED: "FAS 근로자 삭제",
  MONTH_END_SNAPSHOT: "월말 스냅샷",
  DATA_RETENTION_CLEANUP: "데이터 보존 정리",
  ACTION_STATUS_CHANGE: "조치 상태 변경",
  REISSUE_JOIN_CODE: "참여 코드 재발급",
  SMS_BULK_SEND: "SMS 일괄 발송",
  NOTIFICATION_SEND: "알림 발송",
  MANUAL_APPROVAL_CREATED: "수동 승인 생성",
  USER_RESTRICTION_CLEARED: "사용자 제한 해제",
  VOTE_CANDIDATE_ADDED: "투표 후보 추가",
  VOTE_CANDIDATE_REMOVED: "투표 후보 삭제",
  VOTE_PERIOD_UPDATED: "투표 기간 수정",
};

const targetTypeLabels: Record<string, string> = {
  user: "사용자",
  post: "제보",
  site: "현장",
  attendance: "출석",
  vote: "투표",
  action: "조치",
  announcement: "공지",
  points: "포인트",
  education: "교육",
  notification: "알림",
};

export default function AuditPage() {
  const { data: logs = [], isLoading } = useAuditLogs();

  const columns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: "일시",
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleString("ko-KR"),
    },
    {
      key: "action",
      header: "액션",
      render: (item) => actionLabels[item.action] || item.action,
    },
    {
      key: "targetType",
      header: "대상 유형",
      render: (item) => targetTypeLabels[item.targetType] || item.targetType,
    },
    {
      key: "targetId",
      header: "대상 ID",
      render: (item) => (
        <span className="font-mono text-xs">
          {item.targetId?.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: "id",
      header: "수행자",
      render: (item) => item.performer?.name || "시스템",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">감사 로그</h1>

      <DataTable
        columns={columns}
        data={logs}
        searchable
        searchPlaceholder="액션, 대상 검색..."
        emptyMessage={isLoading ? "로딩 중..." : "로그가 없습니다"}
      />
    </div>
  );
}
