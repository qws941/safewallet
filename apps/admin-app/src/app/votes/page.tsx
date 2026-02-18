"use client";

import { useState } from "react";
import { Input } from "@safetywallet/ui";
import { VotePeriodCard } from "./components/vote-period-card";
import { CandidatesCard } from "./components/candidates-card";
import { ResultsCard } from "./components/results-card";

export default function VotesPage() {
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">투표 관리</h1>
        <div className="flex items-center space-x-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <VotePeriodCard month={month} />

      <div className="grid gap-6 md:grid-cols-2">
        <CandidatesCard month={month} />
        <ResultsCard month={month} />
      </div>
    </div>
  );
}
