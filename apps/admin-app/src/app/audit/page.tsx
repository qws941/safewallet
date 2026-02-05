'use client';

import { DataTable, type Column } from '@/components/data-table';
import { useAuditLogs } from '@/hooks/use-api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
  actor: { nameMasked: string };
}

const actionLabels: Record<string, string> = {
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
  APPROVE: '승인',
  REJECT: '거절',
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
};

const entityLabels: Record<string, string> = {
  POST: '제보',
  MEMBER: '회원',
  ANNOUNCEMENT: '공지',
  POINTS: '포인트',
  ACTION: '조치',
};

export default function AuditPage() {
  const { data: logs = [], isLoading } = useAuditLogs();

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: '일시',
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleString('ko-KR'),
    },
    {
      key: 'actor.nameMasked',
      header: '수행자',
    },
    {
      key: 'action',
      header: '액션',
      render: (item) => actionLabels[item.action] || item.action,
    },
    {
      key: 'entityType',
      header: '대상',
      render: (item) => entityLabels[item.entityType] || item.entityType,
    },
    {
      key: 'entityId',
      header: 'ID',
      render: (item) => (
        <span className="font-mono text-xs">{item.entityId.slice(0, 8)}...</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">감사 로그</h1>

      <DataTable
        columns={columns}
        data={logs as AuditLog[]}
        searchable
        searchPlaceholder="수행자, 액션 검색..."
        emptyMessage={isLoading ? '로딩 중...' : '로그가 없습니다'}
      />
    </div>
  );
}
