"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useSiteInfo, useLeaveSite } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  Button,
  Avatar,
  AvatarFallback,
  Skeleton,
  toast,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@safetywallet/ui";

export default function ProfilePage() {
  const router = useRouter();
  const { logout, currentSiteId, setCurrentSite } = useAuth();
  const { data, isLoading } = useProfile();
  const { data: siteData } = useSiteInfo(currentSiteId);
  const leaveSite = useLeaveSite();
  const [leaveOpen, setLeaveOpen] = useState(false);

  const user = data?.data;
  const site = siteData?.data?.site;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleLeaveSite = () => {
    if (!currentSiteId) return;
    leaveSite.mutate(
      { siteId: currentSiteId },
      {
        onSuccess: () => {
          setLeaveOpen(false);
          toast({ title: "완료", description: "현장에서 탈퇴했습니다." });
          setCurrentSite(null);
          router.replace("/join");
        },
        onError: () => {
          toast({
            title: "오류",
            description: "탈퇴에 실패했습니다. 다시 시도해주세요.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="py-6">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {user?.nameMasked?.slice(0, 1) || "👷"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">
                    {user?.nameMasked || "이름 없음"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{user?.phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Site Info */}
        {currentSiteId && (
          <Card>
            <CardContent className="py-4">
              <h3 className="font-medium mb-2">현재 현장</h3>
              <p className="text-sm font-medium">
                {site?.name || "로딩 중..."}
              </p>
              {site?.address && (
                <p className="text-xs text-muted-foreground mt-1">
                  {site.address}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={!currentSiteId}
              >
                <span className="mr-2">📍</span>
                현장 탈퇴하기
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>현장 탈퇴</AlertDialogTitle>
                <AlertDialogDescription>
                  정말로 현재 현장에서 탈퇴하시겠습니까? 탈퇴 후에는 다시
                  가입해야 합니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeaveSite}
                  disabled={leaveSite.isPending}
                >
                  {leaveSite.isPending ? "처리 중..." : "탈퇴하기"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={handleLogout}
          >
            <span className="mr-2">🚶</span>
            로그아웃
          </Button>
        </div>

        {/* App Info */}
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 SafetyWallet</p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
