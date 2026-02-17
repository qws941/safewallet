"use client";

import { useSystemStatus } from "@/hooks/use-api";
import { AlertTriangle, Info, XCircle } from "lucide-react";

const severityStyles = {
  critical: {
    container: "bg-red-50 border-red-200 text-red-800",
    icon: XCircle,
    iconClass: "text-red-600",
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-800",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
  },
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-800",
    icon: Info,
    iconClass: "text-blue-600",
  },
} as const;

export function SystemBanner() {
  const { data } = useSystemStatus();

  if (!data?.data?.hasIssues) {
    return null;
  }

  const { notices } = data.data;

  return (
    <div className="space-y-0">
      {notices.map((notice, index) => {
        const style = severityStyles[notice.severity] ?? severityStyles.info;
        const Icon = style.icon;

        return (
          <div
            key={`${notice.type}-${index}`}
            className={`flex items-start gap-2 px-4 py-2.5 border-b text-sm ${style.container}`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.iconClass}`} />
            <p className="leading-snug">{notice.message}</p>
          </div>
        );
      })}
    </div>
  );
}
