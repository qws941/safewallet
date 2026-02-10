"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { compressImages } from "@/lib/image-compress";
import { useAuth } from "@/hooks/use-auth";
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

const categoryOptions = [
  { value: Category.HAZARD, label: "위험요소", icon: "⚠️" },
  { value: Category.UNSAFE_BEHAVIOR, label: "불안전행동", icon: "🚨" },
  { value: Category.INCONVENIENCE, label: "불편사항", icon: "🛠️" },
  { value: Category.SUGGESTION, label: "개선제안", icon: "💡" },
];

const riskOptions = [
  {
    value: RiskLevel.HIGH,
    label: "높음",
    color: "bg-red-100 border-red-500 text-red-700",
  },
  {
    value: RiskLevel.MEDIUM,
    label: "중간",
    color: "bg-yellow-100 border-yellow-500 text-yellow-700",
  },
  {
    value: RiskLevel.LOW,
    label: "낮음",
    color: "bg-green-100 border-green-500 text-green-700",
  },
];

export default function NewPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentSiteId } = useAuth();
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
          title: "사진은 최대 5장까지 첨부할 수 있습니다.",
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
          title: `${skippedCount}개의 파일이 10MB를 초과하여 제외되었습니다.`,
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
            title: "일부 이미지 업로드 실패",
            description: `${successCount}장 성공, ${failCount}장 실패했습니다.`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "제보가 등록되었습니다.",
      });
      clearDraft();
      router.replace("/posts");
    } catch (error) {
      toast({
        title: "제보 등록 실패",
        description: "잠시 후 다시 시도해주세요.",
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
              <CardTitle className="text-base">제보 유형</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCategory(opt.value);
                    }}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      category === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className="text-xs">{opt.label}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {category === Category.UNSAFE_BEHAVIOR && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium">⚠️ 불안전행동 제보 안내</p>
              <p>
                개인 처벌이 아닌 개선 목적입니다. 얼굴/개인정보 노출에
                주의하세요.
              </p>
            </div>
          )}

          {(category === Category.HAZARD ||
            category === Category.UNSAFE_BEHAVIOR) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">위험 수준</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {riskOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRiskLevel(opt.value)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 text-center transition-colors ${
                        riskLevel === opt.value ? opt.color : "border-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">위치 (선택)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="층수 (예: B1, 3층)"
                value={locationFloor}
                onChange={(e) => setLocationFloor(e.target.value)}
              />
              <Input
                placeholder="구역 (예: A동, 주차장)"
                value={locationZone}
                onChange={(e) => setLocationZone(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">상세 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder="발견한 내용을 자세히 작성해주세요..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[120px] p-3 rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                사진 첨부 ({files.length}/5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
              />

              <div className="grid grid-cols-2 gap-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                      onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}

                {files.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors bg-gray-50"
                  >
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-xs">사진 추가</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span>익명으로 제보하기</span>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </label>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={
              !category || !content || createPost.isPending || isUploading
            }
          >
            {isUploading || createPost.isPending ? "등록 중..." : "제보하기"}
          </Button>
        </form>
        <UnsafeWarningModal
          open={showWarningModal}
          onConfirm={submitPost}
          onCancel={() => setShowWarningModal(false)}
        />
      </main>
    </div>
  );
}
