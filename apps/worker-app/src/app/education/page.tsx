"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import {
  useEducationContents,
  useQuizzes,
  useTbmRecords,
  useAttendTbm,
} from "@/hooks/use-api";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Skeleton,
  useToast,
} from "@safetywallet/ui";
import { cn } from "@/lib/utils";
import { AttendanceGuard } from "@/components/attendance-guard";
import {
  BookOpen,
  FileText,
  Video,
  MonitorPlay,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Users,
} from "lucide-react";

type Tab = "contents" | "quizzes" | "tbm";

const contentTypeIcons: Record<string, React.ElementType> = {
  VIDEO: Video,
  IMAGE: FileText,
  TEXT: FileText,
  DOCUMENT: FileText,
};

export default function EducationPage() {
  const { currentSiteId } = useAuth();
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("contents");

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <div className="sticky top-14 z-30 bg-white border-b border-gray-200 px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("contents")}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "contents"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground",
            )}
          >
            {t("education.materials")}
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "quizzes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground",
            )}
          >
            {t("education.quizzes")}
          </button>
          <button
            onClick={() => setActiveTab("tbm")}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "tbm"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground",
            )}
          >
            {t("education.tbm")}
          </button>
        </div>
      </div>

      <main className="p-4 space-y-4">
        {activeTab === "contents" && (
          <ContentsTab siteId={currentSiteId || ""} />
        )}
        {activeTab === "quizzes" && <QuizzesTab siteId={currentSiteId || ""} />}
        {activeTab === "tbm" && <TbmTab siteId={currentSiteId || ""} />}
      </main>

      <BottomNav />
    </div>
  );
}

function ContentsTab({ siteId }: { siteId: string }) {
  const t = useTranslation();
  const { data: contents, isLoading } = useEducationContents(siteId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!contents || contents.length === 0) {
    return <EmptyState message={t("education.noMaterials")} />;
  }

  return (
    <div className="space-y-3">
      {contents.map((content) => {
        const Icon = contentTypeIcons[content.contentType] || FileText;
        const contentTypeKey =
          `education.contentTypes.${content.contentType}` as const;
        return (
          <AttendanceGuard key={content.id}>
            <Link href={`/education/view?id=${content.id}`}>
              <Card className="active:scale-[0.98] transition-transform">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 h-5"
                      >
                        {t(contentTypeKey) || content.contentType}
                      </Badge>
                      {content.isRequired && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 h-5"
                        >
                          {t("education.required")}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">
                      {content.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(content.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </AttendanceGuard>
        );
      })}
    </div>
  );
}

function QuizzesTab({ siteId }: { siteId: string }) {
  const t = useTranslation();
  const { data: quizzes, isLoading } = useQuizzes(siteId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!quizzes || quizzes.length === 0) {
    return <EmptyState message={t("education.noQuizzes")} />;
  }

  return (
    <div className="space-y-3">
      {quizzes.map((quiz) => (
        <Link key={quiz.id} href={`/education/quiz-take?id=${quiz.id}`}>
          <Card className="active:scale-[0.98] transition-transform">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={quiz.isActive ? "default" : "secondary"}>
                  {quiz.isActive
                    ? t("education.active")
                    : t("education.closed")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {quiz.timeLimitMinutes
                    ? `${quiz.timeLimitMinutes}${t("education.minutes")}`
                    : t("education.unlimited")}
                </span>
              </div>
              <h3 className="font-bold mb-2">{quiz.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {quiz.description || t("education.noDescription")}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {t("education.passingScore")} {quiz.passingScore}점
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    {t("education.maxAttempts")} {quiz.maxAttempts}
                    {t("education.attempts")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function TbmTab({ siteId }: { siteId: string }) {
  const t = useTranslation();
  const { data: records, isLoading } = useTbmRecords(siteId);
  const { mutate: attendTbm, isPending } = useAttendTbm();
  const { toast } = useToast();

  const handleAttend = (id: string) => {
    attendTbm(id, {
      onSuccess: () => toast({ title: t("education.attendanceConfirmed") }),
      onError: (error) => {
        let errorCode = "";
        try {
          const parsed = JSON.parse(error.message);
          errorCode = parsed?.error?.code ?? "";
        } catch {}
        if (errorCode === "ALREADY_ATTENDED") {
          toast({
            title: t("education.alreadyAttended"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("education.attendanceConfirmFailed"),
            variant: "destructive",
          });
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!records || records.length === 0) {
    return <EmptyState message={t("education.noRecords")} />;
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <Card key={record.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-base mb-1">
                  {record.title || record.safetyTopic || t("education.tbm")}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>
                    {t("education.attendance")} {record._count?.attendees || 0}
                    {t("education.attendees")}
                  </span>
                  <span className="mx-1">·</span>
                  <span>{record.leader?.nameMasked}</span>
                </p>
              </div>
              <Badge variant="outline">{record.date}</Badge>
            </div>

            {record.content && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                {record.content}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {record.location || t("education.onSite")}
              </div>
              <Button
                size="sm"
                onClick={() => handleAttend(record.id)}
                disabled={isPending}
              >
                {t("education.attendanceConfirm")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-muted-foreground py-12">
      <p className="text-4xl mb-4">📭</p>
      <p>{message}</p>
    </div>
  );
}
