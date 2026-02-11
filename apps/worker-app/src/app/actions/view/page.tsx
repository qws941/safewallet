"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useAction,
  useUpdateActionStatus,
  useUploadActionImage,
  useDeleteActionImage,
} from "@/hooks/use-api";
import { compressImage } from "@/lib/image-compress";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  useToast,
} from "@safetywallet/ui";
import { ActionStatus, ActionPriority } from "@safetywallet/types";
import { cn } from "@/lib/utils";
import {
  Calendar,
  User,
  CheckCircle,
  AlertTriangle,
  Upload,
  Trash2,
  ArrowLeft,
} from "lucide-react";

const statusColors: Record<string, string> = {
  [ActionStatus.ASSIGNED]: "bg-blue-100 text-blue-800",
  [ActionStatus.IN_PROGRESS]: "bg-amber-100 text-amber-800",
  [ActionStatus.COMPLETED]: "bg-green-100 text-green-800",
  [ActionStatus.VERIFIED]: "bg-emerald-100 text-emerald-800",
  [ActionStatus.OVERDUE]: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  [ActionStatus.ASSIGNED]: "배정됨",
  [ActionStatus.IN_PROGRESS]: "진행중",
  [ActionStatus.COMPLETED]: "완료",
  [ActionStatus.VERIFIED]: "확인됨",
  [ActionStatus.OVERDUE]: "기한초과",
};

const priorityColors: Record<string, string> = {
  [ActionPriority.HIGH]: "bg-red-50 text-red-700",
  [ActionPriority.MEDIUM]: "bg-amber-50 text-amber-700",
  [ActionPriority.LOW]: "bg-gray-50 text-gray-600",
};

const priorityLabels: Record<string, string> = {
  [ActionPriority.HIGH]: "높음",
  [ActionPriority.MEDIUM]: "중간",
  [ActionPriority.LOW]: "낮음",
};

function ActionDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionId = searchParams.get("id");
  const { toast } = useToast();

  const { data, isLoading, error } = useAction(actionId);
  const updateStatus = useUpdateActionStatus();
  const uploadImage = useUploadActionImage();
  const deleteImage = useDeleteActionImage();

  const [completionNote, setCompletionNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"BEFORE" | "AFTER">("BEFORE");

  const action = data?.data;

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

  if (error || !action) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4 flex flex-col items-center justify-center h-full">
          <p className="text-4xl mb-4">❌</p>
          <p className="text-muted-foreground">시정조치를 찾을 수 없습니다.</p>
          <Button className="mt-4" onClick={() => router.back()}>
            돌아가기
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const handleStatusChange = (newStatus: ActionStatus) => {
    if (newStatus === ActionStatus.COMPLETED && !completionNote.trim()) {
      toast({
        title: "입력 필요",
        description: "완료 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    updateStatus.mutate({
      actionId: action.id,
      data: {
        actionStatus: newStatus,
        completionNote:
          newStatus === ActionStatus.COMPLETED ? completionNote : undefined,
      },
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("imageType", uploadType);

      uploadImage.mutate({ actionId: action.id, formData });
    } catch (_err) {
      toast({
        title: "업로드 실패",
        description: "이미지 업로드에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteImage = (imageId: string) => {
    deleteImage.mutate({ actionId: action.id, imageId });
  };

  const triggerFileUpload = (type: "BEFORE" | "AFTER") => {
    setUploadType(type);
    fileInputRef.current?.click();
  };

  const beforeImages =
    action.images?.filter((img) => img.imageType === "BEFORE") || [];
  const afterImages =
    action.images?.filter((img) => img.imageType === "AFTER") || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 p-0 h-auto hover:bg-transparent"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Badge
            className={cn(
              statusColors[action.actionStatus] || "bg-gray-100 text-gray-800",
            )}
          >
            {statusLabels[action.actionStatus] || action.actionStatus}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              priorityColors[action.priority] || "bg-gray-50 text-gray-600",
            )}
          >
            {priorityLabels[action.priority] || action.priority}
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">조치 내용</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap">{action.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  기한:{" "}
                  {action.dueDate
                    ? new Date(action.dueDate).toLocaleDateString()
                    : "미지정"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>담당: {action.assignee?.nameMasked || "미지정"}</span>
              </div>
            </div>

            {action.post && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <span className="font-medium text-gray-700">관련 제보:</span>{" "}
                <span className="text-gray-600">{action.post.title}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">진행 상태</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {action.actionStatus === ActionStatus.ASSIGNED && (
              <Button
                className="w-full"
                onClick={() => handleStatusChange(ActionStatus.IN_PROGRESS)}
                disabled={updateStatus.isPending}
              >
                진행 시작
              </Button>
            )}

            {action.actionStatus === ActionStatus.IN_PROGRESS && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label
                    htmlFor="completionNote"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    완료 내용 (필수)
                  </label>
                  <textarea
                    id="completionNote"
                    placeholder="조치 내용을 입력해주세요."
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={completionNote}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setCompletionNote(e.target.value)
                    }
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleStatusChange(ActionStatus.COMPLETED)}
                  disabled={updateStatus.isPending || !completionNote.trim()}
                >
                  완료 보고
                </Button>
              </div>
            )}

            {action.actionStatus === ActionStatus.COMPLETED && (
              <div className="bg-green-50 p-4 rounded-lg text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                <p className="font-medium text-green-900">조치 완료</p>
                <p className="text-sm text-green-700">
                  관리자 확인 대기중입니다.
                </p>
                {action.completionNote && (
                  <div className="mt-4 text-left bg-white p-3 rounded border border-green-100">
                    <p className="text-xs text-green-600 mb-1">완료 내용</p>
                    <p className="text-sm text-gray-700">
                      {action.completionNote}
                    </p>
                  </div>
                )}
              </div>
            )}

            {action.actionStatus === ActionStatus.VERIFIED && (
              <div className="bg-emerald-50 p-4 rounded-lg text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-medium text-emerald-900">확인 완료</p>
                <p className="text-sm text-emerald-700">
                  모든 절차가 완료되었습니다.
                </p>
              </div>
            )}

            {action.actionStatus === ActionStatus.OVERDUE && (
              <div className="bg-red-50 p-4 rounded-lg text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
                <p className="font-medium text-red-900">기한 초과</p>
                <p className="text-sm text-red-700">
                  조치 기한이 지났습니다. 다시 진행해주세요.
                </p>
                <Button
                  variant="outline"
                  className="mt-2 border-red-200 text-red-700 hover:bg-red-100"
                  onClick={() => handleStatusChange(ActionStatus.IN_PROGRESS)}
                  disabled={updateStatus.isPending}
                >
                  다시 진행
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">조치 전 사진</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerFileUpload("BEFORE")}
              disabled={uploadImage.isPending}
            >
              <Upload className="w-4 h-4 mr-1" />
              업로드
            </Button>
          </CardHeader>
          <CardContent>
            {beforeImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {beforeImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.fileUrl}
                      alt="조치 전"
                      className="w-full h-32 object-cover rounded-md"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>사진 삭제</AlertDialogTitle>
                          <AlertDialogDescription>
                            정말 이 사진을 삭제하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteImage(img.id)}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg text-muted-foreground text-sm">
                등록된 사진이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">조치 후 사진</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerFileUpload("AFTER")}
              disabled={uploadImage.isPending}
            >
              <Upload className="w-4 h-4 mr-1" />
              업로드
            </Button>
          </CardHeader>
          <CardContent>
            {afterImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {afterImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.fileUrl}
                      alt="조치 후"
                      className="w-full h-32 object-cover rounded-md"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>사진 삭제</AlertDialogTitle>
                          <AlertDialogDescription>
                            정말 이 사진을 삭제하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteImage(img.id)}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg text-muted-foreground text-sm">
                등록된 사진이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
      </main>

      <BottomNav />
    </div>
  );
}

export default function ActionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 pb-nav">
          <Header />
          <main className="p-4 space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </main>
          <BottomNav />
        </div>
      }
    >
      <ActionDetailContent />
    </Suspense>
  );
}
