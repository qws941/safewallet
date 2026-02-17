"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
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

function ActionDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionId = searchParams.get("id");
  const { toast } = useToast();
  const t = useTranslation();

  const { data, isLoading, error } = useAction(actionId);
  const updateStatus = useUpdateActionStatus();
  const uploadImage = useUploadActionImage();
  const deleteImage = useDeleteActionImage();

  const [completionNote, setCompletionNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"BEFORE" | "AFTER">("BEFORE");

  const statusLabels: Record<string, string> = {
    [ActionStatus.ASSIGNED]: t("actions.status.assigned"),
    [ActionStatus.IN_PROGRESS]: t("actions.status.inProgress"),
    [ActionStatus.COMPLETED]: t("actions.status.completed"),
    [ActionStatus.VERIFIED]: t("actions.status.verified"),
    [ActionStatus.OVERDUE]: t("actions.status.overdue"),
  };

  const statusColors: Record<string, string> = {
    [ActionStatus.ASSIGNED]: "bg-blue-100 text-blue-800",
    [ActionStatus.IN_PROGRESS]: "bg-amber-100 text-amber-800",
    [ActionStatus.COMPLETED]: "bg-green-100 text-green-800",
    [ActionStatus.VERIFIED]: "bg-emerald-100 text-emerald-800",
    [ActionStatus.OVERDUE]: "bg-red-100 text-red-800",
  };

  const priorityLabels: Record<string, string> = {
    [ActionPriority.HIGH]: t("actions.priority.high"),
    [ActionPriority.MEDIUM]: t("actions.priority.medium"),
    [ActionPriority.LOW]: t("actions.priority.low"),
  };

  const priorityColors: Record<string, string> = {
    [ActionPriority.HIGH]: "bg-red-50 text-red-700",
    [ActionPriority.MEDIUM]: "bg-amber-50 text-amber-700",
    [ActionPriority.LOW]: "bg-gray-50 text-gray-600",
  };

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
          <p className="text-muted-foreground">{t("actions.view.notFound")}</p>
          <Button className="mt-4" onClick={() => router.back()}>
            {t("actions.view.back")}
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const handleStatusChange = (newStatus: ActionStatus) => {
    if (newStatus === ActionStatus.COMPLETED && !completionNote.trim()) {
      toast({
        title: t("actions.view.inputRequired"),
        description: t("actions.view.pleaseEnterCompletion"),
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
        title: t("common.error"),
        description: t("actions.view.uploadError"),
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
            <ArrowLeft className="w-4 h-4" /> {t("actions.view.backList")}
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
            <CardTitle className="text-base">
              {t("actions.view.description")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap">{action.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {t("actions.view.deadline")}:{" "}
                  {action.dueDate
                    ? new Date(action.dueDate).toLocaleDateString()
                    : t("actions.view.notSet")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>
                  {t("actions.view.assignee")}:{" "}
                  {action.assignee?.nameMasked || t("actions.view.notSet")}
                </span>
              </div>
            </div>

            {action.post && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <span className="font-medium text-gray-700">
                  {t("actions.view.relatedReport")}:
                </span>{" "}
                <span className="text-gray-600">{action.post.title}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("actions.view.progressStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {action.actionStatus === ActionStatus.ASSIGNED && (
              <Button
                className="w-full"
                onClick={() => handleStatusChange(ActionStatus.IN_PROGRESS)}
                disabled={updateStatus.isPending}
              >
                {t("actions.view.startProgress")}
              </Button>
            )}

            {action.actionStatus === ActionStatus.IN_PROGRESS && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label
                    htmlFor="completionNote"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t("actions.view.requiredCompletion")}
                  </label>
                  <textarea
                    id="completionNote"
                    placeholder={t("actions.view.completionPlaceholder")}
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
                  {t("actions.view.reportCompletion")}
                </Button>
              </div>
            )}

            {action.actionStatus === ActionStatus.COMPLETED && (
              <div className="bg-green-50 p-4 rounded-lg text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                <p className="font-medium text-green-900">
                  {t("actions.view.completionMessage")}
                </p>
                <p className="text-sm text-green-700">
                  {t("actions.view.awaitingReview")}
                </p>
                {action.completionNote && (
                  <div className="mt-4 text-left bg-white p-3 rounded border border-green-100">
                    <p className="text-xs text-green-600 mb-1">
                      {t("actions.view.completionContent")}
                    </p>
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
                <p className="font-medium text-emerald-900">
                  {t("actions.view.verificationComplete")}
                </p>
                <p className="text-sm text-emerald-700">
                  {t("actions.view.allCompleted")}
                </p>
              </div>
            )}

            {action.actionStatus === ActionStatus.OVERDUE && (
              <div className="bg-red-50 p-4 rounded-lg text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
                <p className="font-medium text-red-900">
                  {t("actions.view.overdue")}
                </p>
                <p className="text-sm text-red-700">
                  {t("actions.view.overdueMessage")}
                </p>
                <Button
                  variant="outline"
                  className="mt-2 border-red-200 text-red-700 hover:bg-red-100"
                  onClick={() => handleStatusChange(ActionStatus.IN_PROGRESS)}
                  disabled={updateStatus.isPending}
                >
                  {t("actions.view.resumeProgress")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t("actions.view.beforePhotos")}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerFileUpload("BEFORE")}
              disabled={uploadImage.isPending}
            >
              <Upload className="w-4 h-4 mr-1" />
              {t("actions.view.upload")}
            </Button>
          </CardHeader>
          <CardContent>
            {beforeImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {beforeImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.fileUrl}
                      alt={t("actions.view.beforeCaption")}
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
                          <AlertDialogTitle>
                            {t("actions.view.deletePhoto")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("actions.view.confirmDelete")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("actions.view.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteImage(img.id)}
                          >
                            {t("actions.view.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg text-muted-foreground text-sm">
                {t("actions.view.noPhotos")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t("actions.view.afterPhotos")}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerFileUpload("AFTER")}
              disabled={uploadImage.isPending}
            >
              <Upload className="w-4 h-4 mr-1" />
              {t("actions.view.upload")}
            </Button>
          </CardHeader>
          <CardContent>
            {afterImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {afterImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.fileUrl}
                      alt={t("actions.view.afterCaption")}
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
                          <AlertDialogTitle>
                            {t("actions.view.deletePhoto")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("actions.view.confirmDelete")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("actions.view.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteImage(img.id)}
                          >
                            {t("actions.view.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg text-muted-foreground text-sm">
                {t("actions.view.noPhotos")}
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

export default function ActionDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ActionDetailContent />
    </Suspense>
  );
}
