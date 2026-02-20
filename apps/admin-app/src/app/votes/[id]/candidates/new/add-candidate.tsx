"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
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
import { ArrowLeft, Plus, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

import { useAuthStore } from "@/stores/auth";

interface User {
  id: string;
  name: string | null;
  nameMasked: string | null;
  companyName: string | null;
  tradeType: string | null;
  role: string;
}

interface UsersResponse {
  users: User[];
  total: number;
}

export default function AddCandidatePage() {
  const router = useRouter();
  const params = useParams();
  const month = params.id as string;
  const siteId = useAuthStore((s) => s.currentSiteId);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["users"],
    queryFn: () => apiFetch<UsersResponse>(`/admin/users?limit=50`),
  });

  const addCandidateMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiFetch("/admin/votes/candidates", {
        method: "POST",
        body: JSON.stringify({
          userId,
          siteId,
          month,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["votes", "results", siteId, month],
      });
      router.push(`/votes/${month}`);
    },
  });

  if (!siteId) {
    return <div className="p-6">현장을 선택해주세요.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">후보자 등록</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>소속</TableHead>
                <TableHead>직종</TableHead>
                <TableHead className="text-right">선택</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.nameMasked || user.name}</TableCell>
                  <TableCell>{user.companyName || "-"}</TableCell>
                  <TableCell>{user.tradeType || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => addCandidateMutation.mutate(user.id)}
                      disabled={addCandidateMutation.isPending}
                    >
                      {addCandidateMutation.isPending ? "등록 중..." : "등록"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
