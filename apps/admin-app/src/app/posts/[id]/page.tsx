'use client';

export const runtime = 'edge';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Badge, Skeleton } from '@safetywallet/ui';
import { ReviewActions } from '@/components/review-actions';
import { useAdminPost } from '@/hooks/use-api';
import { ReviewStatus, Category } from '@safetywallet/types';

const statusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: '접수됨',
  [ReviewStatus.IN_REVIEW]: '검토 중',
  [ReviewStatus.NEED_INFO]: '추가정보 필요',
  [ReviewStatus.APPROVED]: '승인됨',
  [ReviewStatus.REJECTED]: '거절됨',
};

const categoryLabels: Record<Category, string> = {
  [Category.HAZARD]: '위험요소',
  [Category.UNSAFE_BEHAVIOR]: '불안전 행동',
  [Category.INCONVENIENCE]: '불편사항',
  [Category.SUGGESTION]: '개선 제안',
  [Category.BEST_PRACTICE]: '모범 사례',
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params?.id as string;
  const { data: post, isLoading, refetch } = useAdminPost(postId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center">
        <p>제보를 찾을 수 없습니다</p>
        <Button variant="link" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  const canReview =
    post.status === ReviewStatus.RECEIVED ||
    post.status === ReviewStatus.IN_REVIEW;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">제보 상세</h1>
      </div>

      <Card className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{post.title}</h2>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline">
                {categoryLabels[post.category] || post.category}
              </Badge>
              <Badge>{statusLabels[post.status] || post.status}</Badge>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{post.author.nameMasked}</p>
            <p>{new Date(post.createdAt).toLocaleString('ko-KR')}</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 font-medium">내용</h3>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {post.description}
          </p>
        </div>

        {post.location && (
          <div className="mb-6">
            <h3 className="mb-2 font-medium">위치</h3>
            <p className="text-muted-foreground">{post.location}</p>
          </div>
        )}

        {post.photos && post.photos.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 font-medium">첨부 사진</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {post.photos.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo}
                  alt={`첨부 사진 ${idx + 1}`}
                  className="aspect-square rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        )}

        {canReview && (
          <div className="border-t pt-6">
            <h3 className="mb-4 font-medium">검토 액션</h3>
            <ReviewActions postId={postId} onComplete={() => refetch()} />
          </div>
        )}
      </Card>
    </div>
  );
}
