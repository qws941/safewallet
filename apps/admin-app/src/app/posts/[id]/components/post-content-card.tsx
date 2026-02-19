"use client";

import {
  MapPin,
  AlertTriangle,
  Clock,
  User,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import Image from "next/image";
import { Card, Badge } from "@safetywallet/ui";
import { ActionStatus } from "@safetywallet/types";
import { ReviewActions } from "@/components/review-actions";
import type { Post } from "../post-detail-helpers";
import {
  categoryLabels,
  statusLabels,
  statusColors,
  riskLabels,
  actionStatusLabels,
  actionStatusColors,
  buildLocationString,
} from "../post-detail-helpers";

interface PostContentCardProps {
  post: Post;
  postId: string;
  canReview: boolean;
  onRefresh: () => void;
}

export function PostContentCard({
  post,
  postId,
  canReview,
  onRefresh,
}: PostContentCardProps) {
  const location = buildLocationString(post);

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {categoryLabels[post.category] || post.category}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">
              {categoryLabels[post.category] || post.category}
            </Badge>
            <Badge className={statusColors[post.status] || ""}>
              {statusLabels[post.status] || post.status}
            </Badge>
            {post.riskLevel && riskLabels[post.riskLevel] && (
              <Badge className={riskLabels[post.riskLevel].color}>
                <AlertTriangle className="mr-1 h-3 w-3" />
                위험도: {riskLabels[post.riskLevel].label}
              </Badge>
            )}
            {post.isUrgent && (
              <Badge className="bg-red-600 text-white">긴급</Badge>
            )}
            {post.actionStatus && post.actionStatus !== ActionStatus.NONE && (
              <Badge
                className={
                  actionStatusColors[post.actionStatus as ActionStatus] || ""
                }
              >
                조치:{" "}
                {actionStatusLabels[post.actionStatus as ActionStatus] ||
                  post.actionStatus}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div className="flex items-center justify-end gap-1">
            <User className="h-3 w-3" />
            <span>{post.author?.nameMasked || "익명"}</span>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(post.createdAt).toLocaleString("ko-KR")}</span>
          </div>
        </div>
      </div>

      {(location || post.site) && (
        <div className="mb-6">
          <h3 className="mb-2 flex items-center gap-2 font-medium">
            <MapPin className="h-4 w-4" />
            위치
          </h3>
          <p className="text-muted-foreground">
            {post.site?.name}
            {location && ` · ${location}`}
          </p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-2 flex items-center gap-2 font-medium">
          <MessageSquare className="h-4 w-4" />
          내용
        </h3>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {post.content}
        </p>
      </div>

      {post.images && post.images.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 flex items-center gap-2 font-medium">
            <ImageIcon className="h-4 w-4" />
            첨부 사진 ({post.images.length})
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {post.images.map(
              (
                img: { fileUrl: string; thumbnailUrl?: string },
                idx: number,
              ) => (
                <a
                  key={img.fileUrl}
                  href={img.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={img.thumbnailUrl || img.fileUrl}
                    alt={`첨부 ${idx + 1}`}
                    width={512}
                    height={512}
                    className="aspect-square w-full rounded-lg border object-cover hover:opacity-80 transition-opacity"
                    unoptimized
                  />
                </a>
              ),
            )}
          </div>
        </div>
      )}

      {canReview && (
        <div className="border-t pt-6">
          <h3 className="mb-4 font-medium">검토 액션</h3>
          <ReviewActions
            postId={postId}
            currentStatus={post.status}
            onComplete={onRefresh}
          />
        </div>
      )}
    </Card>
  );
}
