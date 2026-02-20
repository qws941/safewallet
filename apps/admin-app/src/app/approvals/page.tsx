"use client";

import { useState } from "react";
import { Button } from "@safetywallet/ui";
import { Plus } from "lucide-react";
import { ApprovalDialog } from "@/components/approvals/approval-dialog";
import { ApprovalList } from "@/components/approvals/approval-list";
import { cn } from "@/lib/utils";

export default function ApprovalsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"PENDING" | "HISTORY">("PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">승인 관리</h1>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          수동 승인 생성
        </Button>
      </div>

      <div className="flex border-b">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors hover:text-primary",
            activeTab === "PENDING"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground",
          )}
          onClick={() => setActiveTab("PENDING")}
        >
          대기 중
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors hover:text-primary",
            activeTab === "HISTORY"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground",
          )}
          onClick={() => setActiveTab("HISTORY")}
        >
          처리 내역
        </button>
      </div>

      <div className="min-h-[400px]">
        <ApprovalList status={activeTab} selectable={activeTab === "PENDING"} />
      </div>

      <ApprovalDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
