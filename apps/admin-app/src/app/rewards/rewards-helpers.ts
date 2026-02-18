"use client";

export type TabKey = "rankings" | "criteria" | "history" | "export";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "rankings", label: "월간 순위" },
  { key: "criteria", label: "포상 기준 설정" },
  { key: "history", label: "지급 내역" },
  { key: "export", label: "내보내기" },
];

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
