'use client';

export const runtime = 'edge';

import { useParams, useRouter } from 'next/navigation';
import { usePost } from '@/hooks/use-api';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Button } from '@safetywallet/ui';
import { cn } from '@/lib/utils';
import { Category, ReviewStatus, ActionStatus } from '@safetywallet/types';

const categoryLabels: Record<Category, string> = {
  [Category.HAZARD]: '위험요소',
  [Category.UNSAFE_BEHAVIOR]: '불안전행동',
  [Category.INCONVENIENCE]: '불편사항',
  [Category.SUGGESTION]: '개선제안',
  [Category.BEST_PRACTICE]: '우수사례',
};

const reviewStatusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: '접수됨',
  [ReviewStatus.IN_REVIEW]: '검토 중',
  [ReviewStatus.NEED_INFO]: '추가정보 필요',
  [ReviewStatus.APPROVED]: '승인됨',
  [ReviewStatus.REJECTED]: '반려됨',
};

const reviewStatusColors: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: 'bg-gray-100 text-gray-700',
  [ReviewStatus.IN_REVIEW]: 'bg-blue-100 text-blue-700',
  [ReviewStatus.NEED_INFO]: 'bg-yellow-100 text-yellow-700',
  [ReviewStatus.APPROVED]: 'bg-green-100 text-green-700',
  [ReviewStatus.REJECTED]: 'bg-red-100 text-red-700',
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { data, isLoading, error } = usePost(postId);

  const post = data?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4">
          <div className="text-center py-12">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-muted-foreground">제보를 찾을 수 없습니다.</p>
            <Button className="mt-4" onClick={() => router.back()}>
              돌아가기
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />
      
      <main className="p-4 space-y-4">
        {/* Status Badges */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {categoryLabels[post.category as Category] || post.category}
          </Badge>
          <Badge className={cn(reviewStatusColors[post.reviewStatus as ReviewStatus])}>
            {reviewStatusLabels[post.reviewStatus as ReviewStatus] || post.reviewStatus}
          </Badge>
          {post.isUrgent && <Badge variant="destructive">긴급</Badge>}
        </div>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-1">
                {post.images.map((img, idx) => (
                  <img
                    key={img.id || idx}
                    src={img.fileUrl}
                    alt={`사진 ${idx + 1}`}
                    className="w-full h-32 object-cover rounded"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">상세 내용</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{post.content}</p>
          </CardContent>
        </Card>

        {/* Location */}
        {(post.locationFloor || post.locationZone) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">위치</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                {post.locationFloor && <span>{post.locationFloor}</span>}
                {post.locationFloor && post.locationZone && ' / '}
                {post.locationZone && <span>{post.locationZone}</span>}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Meta Info */}
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>제보일: {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</p>
              {post.author && <p>제보자: {post.author.nameMasked}</p>}
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
