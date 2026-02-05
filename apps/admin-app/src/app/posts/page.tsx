'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge } from '@safetywallet/ui';
import { DataTable, type Column } from '@/components/data-table';
import { useAdminPosts } from '@/hooks/use-api';
import { ReviewStatus, Category } from '@safetywallet/types';

const statusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: '접수됨',
  [ReviewStatus.IN_REVIEW]: '검토 중',
  [ReviewStatus.NEED_INFO]: '추가정보 필요',
  [ReviewStatus.APPROVED]: '승인됨',
  [ReviewStatus.REJECTED]: '거절됨',
};

const statusColors: Record<ReviewStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [ReviewStatus.RECEIVED]: 'default',
  [ReviewStatus.IN_REVIEW]: 'secondary',
  [ReviewStatus.NEED_INFO]: 'outline',
  [ReviewStatus.APPROVED]: 'default',
  [ReviewStatus.REJECTED]: 'destructive',
};

const categoryLabels: Record<Category, string> = {
  [Category.HAZARD]: '위험요소',
  [Category.UNSAFE_BEHAVIOR]: '불안전 행동',
  [Category.INCONVENIENCE]: '불편사항',
  [Category.SUGGESTION]: '개선 제안',
  [Category.BEST_PRACTICE]: '모범 사례',
};

interface Post {
  id: string;
  title: string;
  category: Category;
  status: ReviewStatus;
  createdAt: string;
  author: { nameMasked: string };
}

export default function PostsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>(undefined);
  const { data: posts = [], isLoading } = useAdminPosts(statusFilter);

  const columns: Column<Post>[] = [
    { key: 'title', header: '제목', sortable: true },
    {
      key: 'category',
      header: '카테고리',
      render: (item) => categoryLabels[item.category] || item.category,
    },
    {
      key: 'status',
      header: '상태',
      render: (item) => (
        <Badge variant={statusColors[item.status]}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'author.nameMasked',
      header: '작성자',
    },
    {
      key: 'createdAt',
      header: '작성일',
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleDateString('ko-KR'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">제보 관리</h1>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === undefined ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(undefined)}
          >
            전체
          </Button>
          <Button
            variant={statusFilter === ReviewStatus.RECEIVED ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(ReviewStatus.RECEIVED)}
          >
            접수됨
          </Button>
          <Button
            variant={statusFilter === ReviewStatus.IN_REVIEW ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(ReviewStatus.IN_REVIEW)}
          >
            검토 중
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={posts as Post[]}
        searchable
        searchPlaceholder="제목, 작성자 검색..."
        onRowClick={(item) => router.push(`/posts/${item.id}`)}
        emptyMessage={isLoading ? '로딩 중...' : '제보가 없습니다'}
      />
    </div>
  );
}
