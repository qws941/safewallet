"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
} from "@safetywallet/ui";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function NewVotePage() {
  const router = useRouter();
  const [month, setMonth] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!month) return;
    router.push(`/votes/${month}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">새 투표 시작</h1>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>투표 기간 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">투표 월</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              투표 생성
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
