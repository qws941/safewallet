"use client";

export const runtime = "edge";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  AlertTriangle,
  Clock,
  User,
  Image as ImageIcon,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import {
  Button,
  Card,
  Badge,
  Skeleton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@safetywallet/ui";
import { ReviewActions } from "@/components/review-actions";
import { useAdminPost, useMembers } from "@/hooks/use-api";
import { ReviewStatus, Category, RiskLevel } from "@safetywallet/types";
import { useAuthStore } from "@/stores/auth";

const statusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: "접수됨",
  [ReviewStatus.IN_REVIEW]: "검토 중",
  [ReviewStatus.NEED_INFO]: "추가정보 필요",
  [ReviewStatus.APPROVED]: "승인됨",
  [ReviewStatus.REJECTED]: "거절됨",
};

const statusColors: Record<ReviewStatus, string> = {
  [ReviewStatus.RECEIVED]: "bg-blue-100 text-blue-800",
  [ReviewStatus.IN_REVIEW]: "bg-yellow-100 text-yellow-800",
  [ReviewStatus.NEED_INFO]: "bg-orange-100 text-orange-800",
  [ReviewStatus.APPROVED]: "bg-green-100 text-green-800",
  [ReviewStatus.REJECTED]: "bg-red-100 text-red-800",
};

const categoryLabels: Record<Category, string> = {
  [Category.HAZARD]: "위험요소",
  [Category.UNSAFE_BEHAVIOR]: "불안전 행동",
  [Category.INCONVENIENCE]: "불편사항",
  [Category.SUGGESTION]: "개선 제안",
  [Category.BEST_PRACTICE]: "모범 사례",
};

const riskLabels: Record<string, { label: string; color: string }> = {
  [RiskLevel.HIGH]: { label: "높음", color: "bg-red-100 text-red-800" },
  [RiskLevel.MEDIUM]: {
    label: "보통",
    color: "bg-yellow-100 text-yellow-800",
  },
  [RiskLevel.LOW]: { label: "낮음", color: "bg-green-100 text-green-800" },
};

const reviewActionLabels: Record<string, string> = {
  APPROVE: "승인",
  REJECT: "거절",
  REQUEST_MORE: "추가정보 요청",
  MARK_URGENT: "긴급 지정",
  ASSIGN: "시정조치 배정",
  CLOSE: "종결",
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params?.id as string;
  const { currentSiteId } = useAuthStore();
  const { data: post, isLoading, refetch } = useAdminPost(postId);
  const { data: members } = useMembers(currentSiteId ?? "");

  const [showAssign, setShowAssign] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [actionNote, setActionNote] = useState("");

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

  const canReview =
    post.status === ReviewStatus.RECEIVED ||
    post.status === ReviewStatus.IN_REVIEW;

  const location = [
    post.locationFloor && `${post.locationFloor}층`,
    post.locationZone,
    post.locationDetail,
  ]
    .filter(Boolean)
    .join(" · ");

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
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  <User className="h-3 w-3" />
                  <span>{post.author?.nameMasked || "익명"}</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {new Date(post.createdAt).toLocaleString("ko-KR")}
                  </span>
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
                        <img
                          src={img.thumbnailUrl || img.fileUrl}
                          alt={`첨부 ${idx + 1}`}
                          className="aspect-square w-full rounded-lg border object-cover hover:opacity-80 transition-opacity"
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
                <ReviewActions postId={postId} onComplete={() => refetch()} />
              </div>
            )}
          </Card>

          {canReview && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-medium">
                  <UserPlus className="h-4 w-4" />
                  시정조치 배정
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssign(!showAssign)}
                >
                  {showAssign ? "취소" : "배정하기"}
                </Button>
              </div>
              {showAssign && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="assignee-select"
                      className="text-sm font-medium"
                    >
                      담당자
                    </label>
                    <Select value={assignee} onValueChange={setAssignee}>
                      <SelectTrigger id="assignee-select">
                        <SelectValue placeholder="담당자 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {members?.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.user.nameMasked}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="due-date-input"
                      className="text-sm font-medium"
                    >
                      마감일
                    </label>
                    <Input
                      id="due-date-input"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="action-note"
                      className="text-sm font-medium"
                    >
                      비고
                    </label>
                    <textarea
                      id="action-note"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="시정조치 내용을 입력하세요"
                      value={actionNote}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setActionNote(e.target.value)
                      }
                    />
                  </div>
                  <Button disabled={!assignee || !dueDate} className="w-full">
                    시정조치 배정
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 font-medium">검토 이력</h3>
            {post?.reviews &&
            (post.reviews as Array<Record<string, unknown>>).length > 0 ? (
              <div className="space-y-4">
                {(
                  post.reviews as Array<{
                    id: string;
                    action: string;
                    comment?: string;
                    reasonCode?: string;
                    adminName?: string;
                    createdAt: string;
                  }>
                ).map((review) => (
                  <div
                    key={review.id}
                    className="border-l-2 border-gray-200 pl-4 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {reviewActionLabels[review.action] || review.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    {review.adminName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        처리자: {review.adminName}
                      </p>
                    )}
                    {review.comment && (
                      <p className="text-sm mt-1">{review.comment}</p>
                    )}
                    {review.reasonCode && (
                      <p className="text-xs text-muted-foreground mt-1">
                        사유: {review.reasonCode}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                아직 검토 이력이 없습니다
              </p>
            )}
          </Card>

          {post.metadata && (
            <Card className="p-6">
              <h3 className="mb-4 font-medium">추가 정보</h3>
              <dl className="space-y-2 text-sm">
                {Object.entries(post.metadata as Record<string, unknown>).map(
                  ([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{String(value)}</dd>
                    </div>
                  ),
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
