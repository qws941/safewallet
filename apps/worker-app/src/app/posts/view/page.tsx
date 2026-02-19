"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { usePost } from "@/hooks/use-api";
import { useTranslation } from "@/hooks/use-translation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Button,
} from "@safetywallet/ui";
import { cn } from "@/lib/utils";
import { Category, ReviewStatus, RejectReason } from "@safetywallet/types";
import { AlertCircle, HelpCircle } from "lucide-react";

function LoadingState() {
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

function PostDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslation();
  const postId = searchParams.get("id") || "";
  const { data, isLoading, error } = usePost(postId);

  const post = data?.data;

  // API 응답에 reviews가 포함될 수 있으나 PostDto에 미정의
  interface ReviewEntry {
    createdAt: string;
    action: string;
    rejectionReason?: string;
    rejectionNote?: string;
    reasonCode?: string;
    comment?: string;
    adminId?: string;
  }
  const postWithReviews = post as typeof post & { reviews?: ReviewEntry[] };
  const reviews = postWithReviews?.reviews;
  const latestReview = reviews?.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  const getCategoryLabel = (category: Category) => {
    const categoryMap: Record<Category, string> = {
      [Category.HAZARD]: t("posts.category.hazard"),
      [Category.UNSAFE_BEHAVIOR]: t("posts.category.unsafeBehavior"),
      [Category.INCONVENIENCE]: t("posts.category.inconvenience"),
      [Category.SUGGESTION]: t("posts.category.suggestion"),
      [Category.BEST_PRACTICE]: t("posts.category.bestPractice"),
    };
    return categoryMap[category] || category;
  };

  const getReviewStatusLabel = (status: ReviewStatus) => {
    const statusMap: Record<ReviewStatus, string> = {
      [ReviewStatus.PENDING]: t("posts.view.received"),
      [ReviewStatus.IN_REVIEW]: t("posts.view.inReview"),
      [ReviewStatus.NEED_INFO]: t("posts.view.needInfo"),
      [ReviewStatus.APPROVED]: t("posts.view.approved"),
      [ReviewStatus.REJECTED]: t("posts.view.rejected"),
      [ReviewStatus.URGENT]: t("posts.view.urgent"),
    };
    return statusMap[status] || status;
  };

  const getRejectReasonLabel = (reason: RejectReason) => {
    const reasonMap: Record<RejectReason, string> = {
      [RejectReason.DUPLICATE]: t("posts.rejectReasons.duplicate"),
      [RejectReason.UNCLEAR_PHOTO]: t("posts.rejectReasons.unclearPhoto"),
      [RejectReason.INSUFFICIENT]: t("posts.rejectReasons.insufficient"),
      [RejectReason.FALSE]: t("posts.rejectReasons.false"),
      [RejectReason.IRRELEVANT]: t("posts.rejectReasons.irrelevant"),
      [RejectReason.OTHER]: t("posts.rejectReasons.other"),
    };
    return reasonMap[reason] || reason;
  };

  const reviewStatusColors: Record<ReviewStatus, string> = {
    [ReviewStatus.PENDING]: "bg-gray-100 text-gray-700",
    [ReviewStatus.IN_REVIEW]: "bg-blue-100 text-blue-700",
    [ReviewStatus.NEED_INFO]: "bg-yellow-100 text-yellow-700",
    [ReviewStatus.APPROVED]: "bg-green-100 text-green-700",
    [ReviewStatus.REJECTED]: "bg-red-100 text-red-700",
    [ReviewStatus.URGENT]: "bg-red-200 text-red-800 font-semibold",
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4">
          <div className="text-center py-12">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-muted-foreground">{t("posts.view.notFound")}</p>
            <Button className="mt-4" onClick={() => router.back()}>
              {t("posts.view.back")}
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
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {getCategoryLabel(post.category as Category)}
          </Badge>
          <Badge
            className={cn(
              reviewStatusColors[post.reviewStatus as ReviewStatus],
            )}
          >
            {getReviewStatusLabel(post.reviewStatus as ReviewStatus)}
          </Badge>
          {post.isUrgent && (
            <Badge variant="destructive">{t("posts.view.urgent")}</Badge>
          )}
        </div>

        {post.reviewStatus === ReviewStatus.REJECTED && latestReview && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <CardTitle className="text-base">
                  {t("posts.view.rejectReasonTitle")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="font-medium text-red-900">
                    {t("posts.view.reason")}
                  </span>
                  <span className="text-red-800">
                    {getRejectReasonLabel(
                      latestReview.reasonCode as RejectReason,
                    )}
                  </span>
                </div>
                {latestReview.comment && (
                  <div className="text-sm text-red-700 bg-white/50 p-2 rounded">
                    {latestReview.comment}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {post.reviewStatus === ReviewStatus.NEED_INFO && latestReview && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-yellow-700">
                <HelpCircle className="h-5 w-5" />
                <CardTitle className="text-base">
                  {t("posts.view.infoRequestTitle")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-yellow-800 bg-white/50 p-2 rounded">
                {latestReview.comment || t("posts.view.adminRequestedInfo")}
              </div>
            </CardContent>
          </Card>
        )}

        {post.images && post.images.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 gap-1">
                {post.images.map((img, idx) => (
                  <Image
                    key={img.id || idx}
                    src={img.fileUrl}
                    alt={`${t("posts.view.photo")} ${idx + 1}`}
                    width={512}
                    height={256}
                    className="w-full h-32 object-cover rounded"
                    unoptimized
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("posts.view.details")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{post.content}</p>
          </CardContent>
        </Card>

        {(post.locationFloor || post.locationZone) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("posts.location")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                {post.locationFloor && <span>{post.locationFloor}</span>}
                {post.locationFloor && post.locationZone && " / "}
                {post.locationZone && <span>{post.locationZone}</span>}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t("posts.view.createdAt")}:{" "}
                {new Date(post.createdAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {post.author && (
                <p>
                  {t("posts.view.createdBy")}: {post.author.nameMasked}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}

export default function PostDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PostDetailContent />
    </Suspense>
  );
}
