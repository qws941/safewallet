"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button, Card, Input } from "@safetywallet/ui";
import { useAuthStore } from "@/stores/auth";
import { useSite, useUpdateSite } from "@/hooks/use-api";

export default function SettingsPage() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const { data: site, isLoading, error } = useSite(siteId || undefined);
  const updateSite = useUpdateSite();
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (site) {
      setName(site.name);
      setActive(site.active);
      setIsDirty(false);
    }
  }, [site]);

  const handleSave = async () => {
    if (!siteId) return;
    try {
      await updateSite.mutateAsync({
        siteId,
        data: { name, active },
      });
      setIsDirty(false);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        현장 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">설정</h1>
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateSite.isPending}
        >
          {updateSite.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          저장
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">현장 정보</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">현장 이름</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsDirty(true);
              }}
              placeholder="현장 이름을 입력하세요"
              className="max-w-md"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => {
                setActive(e.target.checked);
                setIsDirty(true);
              }}
              className="h-5 w-5"
            />
            <label htmlFor="active" className="text-sm">
              <span className="font-medium">현장 활성화</span>
              <p className="text-muted-foreground">
                비활성화 시 새 멤버 가입이 불가합니다.
              </p>
            </label>
          </div>
        </div>
      </Card>

      {updateSite.isSuccess && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          설정이 저장되었습니다.
        </div>
      )}

      {updateSite.isError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          설정 저장에 실패했습니다.
        </div>
      )}
    </div>
  );
}
