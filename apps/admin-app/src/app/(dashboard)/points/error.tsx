"use client";

import { Button } from "@safetywallet/ui";

export default function PointsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-semibold">
        포인트 화면에서 오류가 발생했습니다
      </h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
