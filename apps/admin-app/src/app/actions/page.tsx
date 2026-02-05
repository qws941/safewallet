'use client';

import { Badge } from '@safetywallet/ui';
import { DataTable, type Column } from '@/components/data-table';
import { useActionItems } from '@/hooks/use-api';

interface ActionItem {
  id: string;
  postId: string;
  description: string;
  status: string;
  assignee?: { nameMasked: string };
  dueDate?: string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  NONE: '없음',
  REQUIRED: '필요',
  ASSIGNED: '배정됨',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  REOPENED: '재오픈',
};

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NONE: 'outline',
  REQUIRED: 'destructive',
  ASSIGNED: 'secondary',
  IN_PROGRESS: 'default',
  DONE: 'outline',
  REOPENED: 'destructive',
};

export default function ActionsPage() {
  const { data: actions = [], isLoading } = useActionItems();

  const columns: Column<ActionItem>[] = [
    { key: 'description', header: '내용', sortable: true },
    {
      key: 'status',
      header: '상태',
      render: (item) => (
        <Badge variant={statusColors[item.status] || 'default'}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'assignee.nameMasked',
      header: '담당자',
      render: (item) => item.assignee?.nameMasked || '-',
    },
    {
      key: 'dueDate',
      header: '기한',
      sortable: true,
      render: (item) =>
        item.dueDate
          ? new Date(item.dueDate).toLocaleDateString('ko-KR')
          : '-',
    },
    {
      key: 'createdAt',
      header: '생성일',
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleDateString('ko-KR'),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">조치 현황</h1>

      <DataTable
        columns={columns}
        data={actions as ActionItem[]}
        searchable
        searchPlaceholder="내용, 담당자 검색..."
        emptyMessage={isLoading ? '로딩 중...' : '조치 항목이 없습니다'}
      />
    </div>
  );
}
