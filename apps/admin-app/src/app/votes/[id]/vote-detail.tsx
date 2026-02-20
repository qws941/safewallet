"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Download, Plus, Trash2, Users } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { VoteResultsResponse } from "@/types/vote";

export default function VoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const month = params.id as string;
  const siteId = useAuthStore((s) => s.currentSiteId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<VoteResultsResponse>({
    queryKey: ["votes", "results", siteId, month],
    queryFn: () =>
      apiFetch<VoteResultsResponse>(
        `/admin/votes/results?siteId=${siteId}&month=${month}`,
      ),
    enabled: !!siteId && !!month,
  });

  const deleteMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      await apiFetch(`/admin/votes/candidates/${candidateId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["votes", "results", siteId, month],
      });
      toast({ title: "후보자가 삭제되었습니다." });
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다.", variant: "destructive" });
      setDeletingId(null);
    },
  });

  const handleExportCSV = () => {
    if (!data?.results.length) return;
    const header = "순위,이름,소속,업종,득표수";
    const rows = data.results.map((r, i) =>
      [
        i + 1,
        r.user.nameMasked || r.user.name,
        r.user.companyName || "",
        r.user.tradeType || "",
        r.voteCount,
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `투표결과_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV 파일이 다운로드되었습니다." });
  };

  const getStatus = () => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (month === currentMonthStr) return "ACTIVE";
    if (month > currentMonthStr) return "UPCOMING";
    return "ENDED";
  };

  const status = getStatus();
  const totalVotes =
    data?.results.reduce((sum, r) => sum + r.voteCount, 0) || 0;

  if (isLoading) {
    return <div className="p-6">로딩 중...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/votes")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {month} 투표 현황
              {status === "ACTIVE" && (
                <Badge className="bg-green-500">진행중</Badge>
              )}
              {status === "UPCOMING" && <Badge variant="secondary">예정</Badge>}
              {status === "ENDED" && <Badge variant="outline">종료</Badge>}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              총 {totalVotes}명 참여
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!data?.results.length}
          >
            <Download className="h-4 w-4 mr-2" />
            결과 내보내기
          </Button>
          {status !== "ENDED" && (
            <Button
              onClick={() => router.push(`/votes/${month}/candidates/new`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              후보 등록
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              후보자 목록 및 득표 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.results.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                등록된 후보자가 없습니다.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>순위</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>소속</TableHead>
                    <TableHead className="text-right">득표수</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results.map((result, index) => (
                    <TableRow key={result.candidateId}>
                      <TableCell className="font-bold">{index + 1}</TableCell>
                      <TableCell>
                        {result.user.nameMasked || result.user.name}
                      </TableCell>
                      <TableCell>
                        {result.user.companyName}
                        {result.user.tradeType && ` · ${result.user.tradeType}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{
                                width: `${totalVotes > 0 ? (result.voteCount / totalVotes) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="font-bold w-8">
                            {result.voteCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {status !== "ENDED" && (
                          <AlertDialog
                            open={deletingId === result.candidateId}
                            onOpenChange={(open) =>
                              !open && setDeletingId(null)
                            }
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setDeletingId(result.candidateId)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>후보자 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {result.user.nameMasked || result.user.name}{" "}
                                  후보를 삭제하시겠습니까? 이 작업은 되돌릴 수
                                  없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() =>
                                    deleteMutation.mutate(result.candidateId)
                                  }
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
