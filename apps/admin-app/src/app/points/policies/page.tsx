"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, useToast } from "@safetywallet/ui";
import {
  usePolicies,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  type PointPolicy,
} from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";
import { extractCreateData, extractUpdateData } from "./policy-helpers";
import { PoliciesDataTable } from "./components/policies-data-table";
import { PolicyFormDialog } from "./components/policy-form-dialog";
import { DeletePolicyDialog } from "./components/delete-policy-dialog";

export default function PointPoliciesPage() {
  const { currentSiteId } = useAuthStore();
  const { data: policies = [], isLoading } = usePolicies(
    currentSiteId || undefined,
  );
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PointPolicy | null>(null);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);

  const createMutation = useCreatePolicy();
  const updateMutation = useUpdatePolicy();
  const deleteMutation = useDeletePolicy();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentSiteId) return;
    try {
      const data = extractCreateData(
        new FormData(e.currentTarget),
        currentSiteId,
      );
      await createMutation.mutateAsync(data);
      toast({ title: "정책이 생성되었습니다." });
      setIsCreateOpen(false);
    } catch {
      toast({
        title: "생성 실패",
        description: "정책 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPolicy) return;
    try {
      const data = extractUpdateData(new FormData(e.currentTarget));
      await updateMutation.mutateAsync({ id: editingPolicy.id, data });
      toast({ title: "정책이 수정되었습니다." });
      setEditingPolicy(null);
    } catch {
      toast({
        title: "수정 실패",
        description: "정책 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "정책이 삭제되었습니다." });
      setDeletingPolicyId(null);
    } catch {
      toast({
        title: "삭제 실패",
        description: "정책 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">포인트 정책 관리</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          정책 추가
        </Button>
      </div>

      <PoliciesDataTable
        policies={policies}
        onEdit={setEditingPolicy}
        onDelete={setDeletingPolicyId}
      />

      <PolicyFormDialog
        mode="create"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
      />
      <PolicyFormDialog
        mode="edit"
        open={!!editingPolicy}
        onOpenChange={(open) => !open && setEditingPolicy(null)}
        onSubmit={handleUpdate}
        editingPolicy={editingPolicy}
      />
      <DeletePolicyDialog
        open={!!deletingPolicyId}
        onOpenChange={(open) => !open && setDeletingPolicyId(null)}
        onConfirm={() => deletingPolicyId && handleDelete(deletingPolicyId)}
      />
    </div>
  );
}
