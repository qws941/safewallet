'use client';

import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Button, Card, Input } from '@safetywallet/ui';

export default function SettingsPage() {
  const [joinCode, setJoinCode] = useState('SAFE2024');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
  };

  const handleRegenerateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode = '';
    for (let i = 0; i < 8; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setJoinCode(newCode);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">현장 참여 코드</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          근로자들이 앱에서 이 코드를 입력하면 현장에 참여할 수 있습니다.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={joinCode}
            readOnly
            className="max-w-xs font-mono text-lg"
          />
          <Button variant="outline" size="icon" onClick={handleCopyCode}>
            <Copy size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleRegenerateCode}>
            <RefreshCw size={16} />
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">포인트 설정</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">제보 승인 시 기본 포인트</p>
              <p className="text-sm text-muted-foreground">
                제보가 승인될 때 지급되는 기본 포인트
              </p>
            </div>
            <Input
              type="number"
              defaultValue={100}
              className="w-24 text-right"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">긴급 제보 보너스</p>
              <p className="text-sm text-muted-foreground">
                긴급 표시된 제보 승인 시 추가 지급
              </p>
            </div>
            <Input
              type="number"
              defaultValue={50}
              className="w-24 text-right"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">알림 설정</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium">새 제보 알림</p>
              <p className="text-sm text-muted-foreground">
                새로운 제보가 접수되면 알림
              </p>
            </div>
            <input type="checkbox" defaultChecked className="h-5 w-5" />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium">긴급 제보 알림</p>
              <p className="text-sm text-muted-foreground">
                긴급 표시된 제보 즉시 알림
              </p>
            </div>
            <input type="checkbox" defaultChecked className="h-5 w-5" />
          </label>
        </div>
      </Card>
    </div>
  );
}
