import type { VotePeriod, VoteResult } from "@/types/vote";

// ---------------------------------------------------------------------------
// KST date utilities (epoch <-> YYYY-MM-DD)
// ---------------------------------------------------------------------------

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Convert a unix-epoch-seconds string to a YYYY-MM-DD string in KST. */
export function epochToKstDateString(epoch: string): string {
  const kst = new Date(parseInt(epoch) * 1000 + KST_OFFSET_MS);
  return kst.toISOString().split("T")[0];
}

/** Convert a YYYY-MM-DD string to a unix-epoch-seconds string (KST midnight). */
export function dateStringToKstEpoch(dateStr: string): string {
  return Math.floor(
    new Date(dateStr + "T00:00:00+09:00").getTime() / 1000,
  ).toString();
}

// ---------------------------------------------------------------------------
// Period status
// ---------------------------------------------------------------------------

export type PeriodStatus = "UPCOMING" | "ACTIVE" | "ENDED";

export const PERIOD_STATUS_CONFIG: Record<
  PeriodStatus,
  { label: string; className: string }
> = {
  UPCOMING: {
    label: "UPCOMING",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  ACTIVE: {
    label: "ACTIVE",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  ENDED: {
    label: "ENDED",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
};

/** Derive the period status from epoch timestamps. */
export function getPeriodStatus(
  period: VotePeriod | null | undefined,
): PeriodStatus | null {
  if (!period) return null;
  const now = Math.floor(Date.now() / 1000);
  const start = parseInt(period.startDate);
  const end = parseInt(period.endDate);
  if (now < start) return "UPCOMING";
  if (now > end) return "ENDED";
  return "ACTIVE";
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/** Build and download a UTF-8 BOM CSV from vote results. */
export function exportResultsCsv(results: VoteResult[], month: string): void {
  const sorted = [...results].sort((a, b) => b.voteCount - a.voteCount);
  let csv = "순위,이름,소속,득표수\n";
  for (const [index, result] of sorted.entries()) {
    csv += `${index + 1},${result.user.nameMasked},${result.user.companyName},${result.voteCount}\n`;
  }
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vote_results_${month}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
