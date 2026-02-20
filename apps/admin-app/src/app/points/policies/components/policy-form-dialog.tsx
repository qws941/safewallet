"use client";

import {
  Button,
  Input,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@safetywallet/ui";
import type { PointPolicy } from "@/hooks/use-api";

interface PolicyFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  editingPolicy?: PointPolicy | null;
}

export function PolicyFormDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  editingPolicy,
}: PolicyFormDialogProps) {
  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "포인트 정책 수정" : "새 포인트 정책 추가"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "정책 상세 내용을 수정합니다. 코드는 수정할 수 없습니다."
              : "새로운 포인트 지급 정책을 생성합니다. 코드는 고유해야 합니다."}
          </DialogDescription>
        </DialogHeader>
        {(!isEdit || editingPolicy) && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">정책명</label>
                <Input
                  name="name"
                  required
                  defaultValue={isEdit ? editingPolicy?.name : undefined}
                  placeholder={!isEdit ? "예: 안전모 착용" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">정책 코드</label>
                {isEdit ? (
                  <Input
                    value={editingPolicy?.reasonCode}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <Input
                    name="reasonCode"
                    required
                    placeholder="SAFE_HELMET"
                    className="uppercase"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">설명</label>
              <Input
                name="description"
                defaultValue={
                  isEdit ? editingPolicy?.description || "" : undefined
                }
                placeholder={!isEdit ? "정책에 대한 설명" : undefined}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">기본 포인트</label>
                <Input
                  name="defaultAmount"
                  type="number"
                  required
                  defaultValue={isEdit ? editingPolicy?.defaultAmount : 10}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">최소 포인트</label>
                <Input
                  name="minAmount"
                  type="number"
                  defaultValue={
                    isEdit ? editingPolicy?.minAmount || "" : undefined
                  }
                  placeholder={!isEdit ? "선택" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">최대 포인트</label>
                <Input
                  name="maxAmount"
                  type="number"
                  defaultValue={
                    isEdit ? editingPolicy?.maxAmount || "" : undefined
                  }
                  placeholder={!isEdit ? "선택" : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">일일 제한 (회)</label>
                <Input
                  name="dailyLimit"
                  type="number"
                  defaultValue={
                    isEdit ? editingPolicy?.dailyLimit || "" : undefined
                  }
                  placeholder={!isEdit ? "무제한" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">월간 제한 (회)</label>
                <Input
                  name="monthlyLimit"
                  type="number"
                  defaultValue={
                    isEdit ? editingPolicy?.monthlyLimit || "" : undefined
                  }
                  placeholder={!isEdit ? "무제한" : undefined}
                />
              </div>
            </div>

            {isEdit && (
              <div className="flex items-center gap-2">
                <Switch
                  name="isActive"
                  defaultChecked={editingPolicy?.isActive}
                />
                <label className="text-sm font-medium">활성화 상태</label>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button type="submit">{isEdit ? "저장" : "생성"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
