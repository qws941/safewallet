"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Download } from "lucide-react";
import { useVoteResults } from "@/hooks/use-votes";
import { exportResultsCsv } from "../votes-helpers";

interface ResultsCardProps {
  month: string;
}

export function ResultsCard({ month }: ResultsCardProps) {
  const { toast } = useToast();
  const { data: results = [], isLoading } = useVoteResults(month);

  const handleExportCsv = () => {
    if (results.length === 0) {
      toast({
        variant: "destructive",
        title: "내보내기 실패",
        description: "투표 결과가 없습니다.",
      });
      return;
    }
    try {
      exportResultsCsv(results, month);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "내보내기 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">투표 결과</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          내보내기
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">순위</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="text-right">득표수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
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
                      <TableCell className="font-medium">{index + 1}</TableCell>
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
  );
}
