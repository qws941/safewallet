"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, Badge } from "@safetywallet/ui";
import { cn } from "@/lib/utils";
import type { PostListDto } from "@safetywallet/types";
import { Category, ReviewStatus, ActionStatus } from "@safetywallet/types";

interface PostCardProps {
  post: PostListDto;
}

export function PostCard({ post }: PostCardProps) {
  const t = useTranslation();

  const categoryLabels: Record<Category, string> = {
    [Category.HAZARD]: t("posts.category.hazard"),
    [Category.UNSAFE_BEHAVIOR]: t("posts.category.unsafeBehavior"),
    [Category.INCONVENIENCE]: t("posts.category.inconvenience"),
    [Category.SUGGESTION]: t("posts.category.suggestion"),
    [Category.BEST_PRACTICE]: t("posts.category.bestPractice"),
  };

  const reviewStatusLabels: Record<ReviewStatus, string> = {
    [ReviewStatus.PENDING]: t("posts.view.status.pending"),
    [ReviewStatus.IN_REVIEW]: t("posts.view.status.inReview"),
    [ReviewStatus.NEED_INFO]: t("postCard.reviewStatusNeedInfo"),
    [ReviewStatus.APPROVED]: t("posts.view.status.approved"),
    [ReviewStatus.REJECTED]: t("posts.view.status.rejected"),
    [ReviewStatus.URGENT]: t("posts.pageList.urgent"),
  };

  const reviewStatusColors: Record<ReviewStatus, string> = {
    [ReviewStatus.PENDING]: "bg-gray-100 text-gray-700",
    [ReviewStatus.IN_REVIEW]: "bg-blue-100 text-blue-700",
    [ReviewStatus.NEED_INFO]: "bg-yellow-100 text-yellow-700",
    [ReviewStatus.APPROVED]: "bg-green-100 text-green-700",
    [ReviewStatus.REJECTED]: "bg-red-100 text-red-700",
    [ReviewStatus.URGENT]: "bg-red-200 text-red-800 font-semibold",
  };

  const actionStatusLabels: Record<ActionStatus, string> = {
    [ActionStatus.NONE]: "",
    [ActionStatus.ASSIGNED]: t("actions.status.assigned"),
    [ActionStatus.IN_PROGRESS]: t("actions.status.inProgress"),
    [ActionStatus.COMPLETED]: t("actions.status.completed"),
    [ActionStatus.VERIFIED]: t("postCard.actionStatusVerified"),
    [ActionStatus.OVERDUE]: t("actions.status.overdue"),
  };

  const actionStatusColors: Record<ActionStatus, string> = {
    [ActionStatus.NONE]: "",
    [ActionStatus.ASSIGNED]: "bg-purple-100 text-purple-700",
    [ActionStatus.IN_PROGRESS]: "bg-blue-100 text-blue-700",
    [ActionStatus.COMPLETED]: "bg-teal-100 text-teal-700",
    [ActionStatus.VERIFIED]: "bg-green-100 text-green-700",
    [ActionStatus.OVERDUE]: "bg-red-200 text-red-800 font-semibold",
  };

  return (
    <Link href={`/posts/view?id=${post.id}`}>
      <Card className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">
                  {categoryLabels[post.category as Category] || post.category}
                </Badge>
                <Badge
                  className={cn(
                    reviewStatusColors[post.reviewStatus as ReviewStatus],
                  )}
                >
                  {reviewStatusLabels[post.reviewStatus as ReviewStatus] ||
                    post.reviewStatus}
                </Badge>
                {post.reviewStatus === ReviewStatus.APPROVED && (
                  <Badge className="bg-emerald-50 text-emerald-600 font-semibold">
                    +100P
                  </Badge>
                )}
                {post.isUrgent && (
                  <Badge variant="destructive">
                    {t("posts.pageList.urgent")}
                  </Badge>
                )}
                {post.actionStatus &&
                  post.actionStatus !== ActionStatus.NONE && (
                    <Badge
                      className={cn(
                        actionStatusColors[post.actionStatus as ActionStatus],
                      )}
                    >
                      {actionStatusLabels[post.actionStatus as ActionStatus] ||
                        post.actionStatus}
                    </Badge>
                  )}
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {post.content}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>
                  {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
