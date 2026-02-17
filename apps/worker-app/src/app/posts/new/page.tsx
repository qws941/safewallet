"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { compressImages } from "@/lib/image-compress";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/lib/api";
import { useCreatePost } from "@/hooks/use-api";
import { Header } from "@/components/header";
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  useToast,
} from "@safetywallet/ui";
import { UnsafeWarningModal } from "@/components/unsafe-warning-modal";
import { Category, RiskLevel, Visibility } from "@safetywallet/types";
import type { CreatePostDto } from "@safetywallet/types";

export default function NewPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentSiteId } = useAuth();
  const t = useTranslation();
  const createPost = useCreatePost();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [content, setContent] = useState("");
  const [locationFloor, setLocationFloor] = useState("");
  const [locationZone, setLocationZone] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const DRAFT_KEY = `safework2_post_draft_${currentSiteId || "default"}`;

  const categoryOptions = [
    { value: Category.HAZARD, label: "posts.category.hazard", icon: "⚠️" },
    {
      value: Category.UNSAFE_BEHAVIOR,
      label: "posts.category.unsafeBehavior",
      icon: "🚨",
    },
    {
      value: Category.INCONVENIENCE,
      label: "posts.category.inconvenience",
      icon: "🛠️",
    },
    {
      value: Category.SUGGESTION,
      label: "posts.category.suggestion",
      icon: "💡",
    },
  ];

  const riskOptions = [
    {
      value: RiskLevel.HIGH,
      label: "actions.priority.high",
      color: "bg-red-100 border-red-500 text-red-700",
    },
    {
      value: RiskLevel.MEDIUM,
      label: "actions.priority.medium",
      color: "bg-yellow-100 border-yellow-500 text-yellow-700",
    },
    {
      value: RiskLevel.LOW,
      label: "actions.priority.low",
      color: "bg-green-100 border-green-500 text-green-700",
    },
  ];

  const saveDraft = useCallback(() => {
    if (!category && !content) return;
    const draft = {
      category,
      riskLevel,
      content,
      locationFloor,
      locationZone,
      isAnonymous,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage full or unavailable
    }
  }, [
    DRAFT_KEY,
    category,
    riskLevel,
    content,
    locationFloor,
    locationZone,
    isAnonymous,
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (draft.category) setCategory(draft.category);
      if (draft.riskLevel) setRiskLevel(draft.riskLevel);
      if (draft.content) setContent(draft.content);
      if (draft.locationFloor) setLocationFloor(draft.locationFloor);
      if (draft.locationZone) setLocationZone(draft.locationZone);
      if (draft.isAnonymous) setIsAnonymous(draft.isAnonymous);
    } catch {
      // corrupted draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAFT_KEY]);

  useEffect(() => {
    const timer = setTimeout(saveDraft, 2000);
    return () => clearTimeout(timer);
  }, [saveDraft]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      let skippedCount = 0;

      if (files.length + selectedFiles.length > 5) {
        toast({
          title: t("posts.error.uploadFailed"),
          variant: "destructive",
        });
        return;
      }

      selectedFiles.forEach((file) => {
        if (file.size > 10 * 1024 * 1024) {
          skippedCount++;
        } else {
          validFiles.push(file);
        }
      });

      if (skippedCount > 0) {
        toast({
          title: t("common.error"),
          variant: "destructive",
        });
      }

      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPost = async () => {
    if (!category || !currentSiteId) return;

    setIsUploading(true);
    setShowWarningModal(false);

    try {
      const postData: CreatePostDto = {
        siteId: currentSiteId,
        category,
        riskLevel: riskLevel || undefined,
        content,
        locationFloor: locationFloor || undefined,
        locationZone: locationZone || undefined,
        visibility: Visibility.WORKER_PUBLIC,
        isAnonymous,
      };

      const response = await createPost.mutateAsync(postData);
      const postId = response.data.post.id;

      if (files.length > 0) {
        let successCount = 0;
        let failCount = 0;

        const compressedFiles = await compressImages(files);

        for (const file of compressedFiles) {
          const formData = new FormData();
          formData.append("file", file);

          try {
            await apiFetch(`/posts/${postId}/images`, {
              method: "POST",
              body: formData,
            });
            successCount++;
          } catch {
            failCount++;
          }
        }

        if (failCount > 0) {
          toast({
            title: t("posts.error.uploadFailed"),
            description: `${successCount} ${t("common.ok")}, ${failCount} ${t("common.error")}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: t("posts.success.submitted"),
      });
      clearDraft();
      router.replace("/posts");
    } catch (error) {
      toast({
        title: t("posts.error.uploadFailed"),
        description: t("common.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !currentSiteId) return;

    if (category === Category.UNSAFE_BEHAVIOR) {
      setShowWarningModal(true);
      return;
    }

    await submitPost();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("posts.selectCategory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCategory(opt.value);
                      if (opt.value === Category.INCONVENIENCE) {
                        setLocationFloor("");
                        setLocationZone("");
                      }
                    }}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      category === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className="text-xs">{t(opt.label)}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {category === Category.UNSAFE_BEHAVIOR && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">
                ⚠️ {t("posts.category.unsafeBehavior")} {t("common.info")}
              </p>
              <p>{t("posts.new.unsafeBehaviorWarning")}</p>
            </div>
          )}

          {(category === Category.HAZARD ||
            category === Category.UNSAFE_BEHAVIOR) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("common.info")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {riskOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRiskLevel(opt.value)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 text-center transition-colors ${
                        riskLevel === opt.value
                          ? "border-current"
                          : "border-gray-200"
                      } ${opt.color}`}
                    >
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("posts.description")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder={t("posts.description")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary resize-none"
              />
            </CardContent>
          </Card>

          {category !== Category.INCONVENIENCE && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("posts.location")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder={t("posts.location")}
                  value={locationFloor}
                  onChange={(e) => setLocationFloor(e.target.value)}
                />
                <Input
                  placeholder={t("posts.new.zone")}
                  value={locationZone}
                  onChange={(e) => setLocationZone(e.target.value)}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("posts.addPhoto")}</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors"
              >
                {t("posts.addPhoto")}
              </button>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-100 rounded"
                    >
                      <span className="text-sm">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-xs text-destructive hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("common.info")}</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                <span className="text-sm">{t("posts.new.anonymous")}</span>
              </label>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!category || isUploading}
              className="flex-1"
            >
              {isUploading ? t("common.loading") : t("posts.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </main>

      <UnsafeWarningModal
        open={showWarningModal}
        onConfirm={submitPost}
        onCancel={() => setShowWarningModal(false)}
      />
    </div>
  );
}
