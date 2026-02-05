'use client';

import Link from 'next/link';
import { Card, CardContent, Badge } from '@safetywallet/ui';
import { cn } from '@/lib/utils';
import type { PostListDto } from '@safetywallet/types';
import { Category, ReviewStatus, ActionStatus } from '@safetywallet/types';

const categoryLabels: Record<Category, string> = {
  [Category.HAZARD]: '위험요소',
  [Category.UNSAFE_BEHAVIOR]: '불안전행동',
  [Category.INCONVENIENCE]: '불편사항',
  [Category.SUGGESTION]: '개선제안',
  [Category.BEST_PRACTICE]: '우수사례',
};

const reviewStatusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: '접수',
  [ReviewStatus.IN_REVIEW]: '검토중',
  [ReviewStatus.NEED_INFO]: '추가정보',
  [ReviewStatus.APPROVED]: '승인',
  [ReviewStatus.REJECTED]: '반려',
};

const reviewStatusColors: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: 'bg-gray-100 text-gray-700',
  [ReviewStatus.IN_REVIEW]: 'bg-blue-100 text-blue-700',
  [ReviewStatus.NEED_INFO]: 'bg-yellow-100 text-yellow-700',
  [ReviewStatus.APPROVED]: 'bg-green-100 text-green-700',
  [ReviewStatus.REJECTED]: 'bg-red-100 text-red-700',
};

interface PostCardProps {
  post: PostListDto;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Link href={`/posts/${post.id}`}>
      <Card className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">
                  {categoryLabels[post.category as Category] || post.category}
                </Badge>
                <Badge className={cn(reviewStatusColors[post.reviewStatus as ReviewStatus])}>
                  {reviewStatusLabels[post.reviewStatus as ReviewStatus] || post.reviewStatus}
                </Badge>
                {post.isUrgent && (
                  <Badge variant="destructive">긴급</Badge>
                )}
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {post.content}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>{new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
                {post.imageCount > 0 && (
                  <span>📷 {post.imageCount}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
