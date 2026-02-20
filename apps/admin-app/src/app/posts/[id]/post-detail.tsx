"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Skeleton } from "@safetywallet/ui";
import { useAdminPost } from "@/hooks/use-api";
import { canReviewPost } from "./post-detail-helpers";
import { PostContentCard } from "./components/post-content-card";
import { AssignmentForm } from "./components/assignment-form";
import { ReviewHistoryCard } from "./components/review-history-card";
import { MetadataCard } from "./components/metadata-card";

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
      <div className="text-center py-12">
        <p className="text-muted-foreground">제보를 찾을 수 없습니다</p>
        <Button variant="link" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  const canReview = canReviewPost(post.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">제보 상세</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PostContentCard
            post={post}
            postId={postId}
            canReview={canReview}
            onRefresh={() => refetch()}
          />
          {canReview && (
            <AssignmentForm postId={postId} onRefresh={() => refetch()} />
          )}
        </div>

        <div className="space-y-6">
          <ReviewHistoryCard reviews={post.reviews} />
          {post.metadata && <MetadataCard metadata={post.metadata} />}
        </div>
      </div>
    </div>
  );
}
