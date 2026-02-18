"use client";

import { useState } from "react";
import { cn } from "@safetywallet/ui";
import { TABS, type TabKey } from "./rewards-helpers";
import { RankingsTab } from "./components/rankings-tab";
import { CriteriaTab } from "./components/criteria-tab";
import { HistoryTab } from "./components/history-tab";
import { ExportTab } from "./components/export-tab";

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("rankings");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">포상 관리</h1>

      <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rankings" && <RankingsTab />}
      {activeTab === "criteria" && <CriteriaTab />}
      {activeTab === "history" && <HistoryTab />}
      {activeTab === "export" && <ExportTab />}
    </div>
  );
}
