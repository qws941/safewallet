"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEducationContent } from "@/hooks/use-api";
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
import {
  FileText,
  Video,
  Link as LinkIcon,
  Download,
  Calendar,
} from "lucide-react";

const contentTypeLabels: Record<string, string> = {
  VIDEO: "영상",
  IMAGE: "이미지",
  TEXT: "텍스트",
  DOCUMENT: "문서",
};

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

function EducationDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const { data, isLoading, error } = useEducationContent(id);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4">
          <div className="text-center py-12">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-muted-foreground">
              교육자료를 찾을 수 없습니다.
            </p>
            <Button className="mt-4" onClick={() => router.back()}>
              돌아가기
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
            {contentTypeLabels[data.contentType] || data.contentType}
          </Badge>
          {data.isRequired && <Badge variant="destructive">필수 교육</Badge>}
        </div>

        <h1 className="text-xl font-bold">{data.title}</h1>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(data.createdAt).toLocaleDateString("ko-KR")}
        </div>

        {/* Content Type Specific Display */}
        {data.contentType === "VIDEO" && data.contentUrl && (
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <iframe
              src={data.contentUrl}
              className="w-full h-full"
              allowFullScreen
              title={data.title}
            />
          </div>
        )}

        {data.contentType === "IMAGE" && data.contentUrl && (
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <img
              src={data.contentUrl}
              alt={data.title}
              className="w-full h-auto object-contain"
            />
          </div>
        )}

        {data.description && (
          <Card>
            <CardContent className="p-4 bg-gray-50 text-sm text-gray-600">
              {data.description}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">상세 내용</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {data.content}
            </div>
          </CardContent>
        </Card>

        {data.contentType === "DOCUMENT" && data.contentUrl && (
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={() => window.open(data.contentUrl, "_blank")}
          >
            <Download className="w-4 h-4" />
            문서 다운로드
          </Button>
        )}

        <Button
          className="w-full mt-4"
          variant="secondary"
          onClick={() => router.back()}
        >
          목록으로 돌아가기
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

export default function EducationViewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EducationDetailContent />
    </Suspense>
  );
}
