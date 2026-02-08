export interface VoteElection {
  siteId: string;
  month: string; // YYYY-MM
  status: "UPCOMING" | "ACTIVE" | "ENDED";
  candidateCount: number;
  totalVotes: number;
}

export interface VoteCandidate {
  id: string;
  userId: string;
  siteId: string;
  month: string;
  source: "ADMIN" | "AUTO";
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    nameMasked: string | null;
    companyName: string | null;
    tradeType: string | null;
  };
  voteCount?: number;
}

export interface VoteResult {
  user: VoteCandidate["user"];
  voteCount: number;
  candidateId: string;
  source: string;
}

export interface VoteResultsResponse {
  month: string;
  results: VoteResult[];
}

export interface VotePeriod {
  id: string;
  siteId: string;
  month: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}
