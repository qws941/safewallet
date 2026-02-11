"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  buttonVariants,
  DialogDescription,
  DialogFooter,
} from "@safetywallet/ui";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Plus, Trash2, Download, Search } from "lucide-react";
import {
  useVoteCandidates,
  useAddVoteCandidate,
  useDeleteVoteCandidate,
  useVoteResults,
  useVotePeriod,
  useUpdateVotePeriod,
} from "@/hooks/use-votes";
import { useMembers } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";

export default function VotesPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const siteId = useAuthStore((s) => s.currentSiteId);

  const { data: candidates = [], isLoading: isLoadingCandidates } =
    useVoteCandidates(month);
  const { data: results = [], isLoading: isLoadingResults } =
    useVoteResults(month);
  const { data: period } = useVotePeriod(month);
  const { data: members = [] } = useMembers(siteId || undefined);

  const addCandidate = useAddVoteCandidate();
  const deleteCandidate = useDeleteVoteCandidate();
  const updatePeriod = useUpdateVotePeriod();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (period) {
      const start = new Date(parseInt(period.startDate) * 1000);
      const end = new Date(parseInt(period.endDate) * 1000);

      const kstStart = new Date(start.getTime() + 9 * 60 * 60 * 1000);
      const kstEnd = new Date(end.getTime() + 9 * 60 * 60 * 1000);

      setStartDate(kstStart.toISOString().split("T")[0]);
      setEndDate(kstEnd.toISOString().split("T")[0]);
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [period]);

  const handleUpdatePeriod = async () => {
    if (!startDate || !endDate) return;
    try {
      const startEpoch = Math.floor(
        new Date(startDate + "T00:00:00+09:00").getTime() / 1000,
      ).toString();
      const endEpoch = Math.floor(
        new Date(endDate + "T00:00:00+09:00").getTime() / 1000,
      ).toString();

      await updatePeriod.mutateAsync({
        month,
        startDate: startEpoch,
        endDate: endEpoch,
      });
    } catch (error) {
      console.error("Failed to update period:", error);
    }
  };

  const getPeriodStatus = () => {
    if (!period) return null;
    const now = Math.floor(Date.now() / 1000);
    const start = parseInt(period.startDate);
    const end = parseInt(period.endDate);

    if (now < start)
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          UPCOMING
        </Badge>
      );
    if (now > end)
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          ENDED
        </Badge>
      );
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        ACTIVE
      </Badge>
    );
  };

  const handleAddCandidate = async (userId: string) => {
    try {
      await addCandidate.mutateAsync({ userId, month });
      setIsAddDialogOpen(false);
      setSearchTerm("");
    } catch (error) {
      console.error("Failed to add candidate:", error);
    }
  };

  const handleDeleteCandidate = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteCandidate.mutateAsync(deleteTargetId);
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error("Failed to delete candidate:", error);
    }
  };

  const handleExportCsv = async () => {
    try {
      const { tokens } = useAuthStore.getState();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://safework2.jclee.me/api"}/admin/votes/results?siteId=${siteId}&month=${month}&format=csv`,
        {
          headers: {
            Authorization: `Bearer ${tokens?.accessToken}`,
          },
        },
      );

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vote_results_${month}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      member.user.nameMasked.includes(searchTerm) ||
      member.user.phone.includes(searchTerm),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">투표 관리</h1>
        <div className="flex items-center space-x-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Vote Period Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">투표 기간 설정</CardTitle>
          {getPeriodStatus()}
        </CardHeader>
        <CardContent>
          <div className="flex items-end space-x-4">
            <div className="space-y-2">
              <label htmlFor="startDate" className="text-sm font-medium">
                시작일
              </label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="endDate" className="text-sm font-medium">
                종료일
              </label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              onClick={handleUpdatePeriod}
              disabled={updatePeriod.isPending}
            >
              {updatePeriod.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Candidates Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">후보자 관리</CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  후보자 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>후보자 추가</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="이름 또는 전화번호 검색"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer w-full text-left"
                        onClick={() => handleAddCandidate(member.userId)}
                        type="button"
                      >
                        <div>
                          <p className="font-medium">
                            {member.user.nameMasked}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.user.phone}
                          </p>
                        </div>
                        <span
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          선택
                        </span>
                      </button>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        검색 결과가 없습니다
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCandidates ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : candidates.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        등록된 후보자가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          {candidate.user.nameMasked}
                          <span className="text-xs text-muted-foreground block">
                            {candidate.user.companyName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              candidate.source === "ADMIN"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {candidate.source === "ADMIN" ? "관리자" : "자동"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(candidate.createdAt).toLocaleDateString(
                            "ko-KR",
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteTargetId(candidate.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Dialog
              open={isDeleteDialogOpen}
              onOpenChange={setIsDeleteDialogOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>후보자 삭제</DialogTitle>
                  <DialogDescription>
                    정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteCandidate}>
                    삭제
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">투표 결과</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              내보내기
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">순위</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead className="text-right">득표수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingResults ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        로딩 중...
                      </TableCell>
                    </TableRow>
                  ) : results.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center py-8 text-muted-foreground"
                      >
                        투표 결과가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    results
                      .sort((a, b) => b.voteCount - a.voteCount)
                      .map((result, index) => (
                        <TableRow key={result.candidateId}>
                          <TableCell className="font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            {result.user.nameMasked}
                            <span className="text-xs text-muted-foreground block">
                              {result.user.companyName}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {result.voteCount}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
