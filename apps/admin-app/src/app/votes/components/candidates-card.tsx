"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  buttonVariants,
  useToast,
} from "@safetywallet/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  useVoteCandidates,
  useAddVoteCandidate,
  useDeleteVoteCandidate,
} from "@/hooks/use-votes";
import { useMembers } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";

interface CandidatesCardProps {
  month: string;
}

export function CandidatesCard({ month }: CandidatesCardProps) {
  const { toast } = useToast();
  const siteId = useAuthStore((s) => s.currentSiteId);

  const { data: candidates = [], isLoading } = useVoteCandidates(month);
  const { data: members = [] } = useMembers(siteId || undefined);
  const addCandidate = useAddVoteCandidate();
  const deleteCandidate = useDeleteVoteCandidate();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const filteredMembers = members.filter(
    (member) =>
      member.user.nameMasked.includes(searchTerm) ||
      member.user.phone.includes(searchTerm),
  );

  const handleAddCandidate = async (userId: string) => {
    try {
      await addCandidate.mutateAsync({ userId, month });
      setIsAddDialogOpen(false);
      setSearchTerm("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "후보자 추가 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  };

  const handleDeleteCandidate = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteCandidate.mutateAsync(deleteTargetId);
      setIsDeleteDialogOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "후보자 삭제 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  };

  return (
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
                      <p className="font-medium">{member.user.nameMasked}</p>
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
        <div className="overflow-x-auto rounded-md border">
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
              {isLoading ? (
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
                          candidate.source === "ADMIN" ? "default" : "secondary"
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
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
  );
}
