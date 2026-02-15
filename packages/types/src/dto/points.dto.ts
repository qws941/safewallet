export interface AwardPointsDto {
  userId: string;
  siteId: string;
  postId?: string;
  amount: number;
  reasonCode: string;
  reasonText?: string;
}

export interface RevokePointsDto {
  ledgerId: string;
  reason: string;
}

export interface PointsLedgerDto {
  id: string;
  userId: string;
  siteId: string;
  postId: string | null;
  amount: number;
  reasonCode: string;
  reasonText: string | null;
  settleMonth: string;
  occurredAt: string;
  createdAt: string;
}

export interface PointsBalanceDto {
  userId: string;
  siteId: string;
  totalPoints: number;
  currentMonthPoints: number;
  settleMonth: string;
}

export interface PointsHistoryItemDto {
  id: string;
  amount: number;
  reasonCode: string;
  reasonText: string | null;
  createdAt: string;
}

export interface PointsHistoryFilterDto {
  siteId: string;
  userId?: string;
  settleMonth?: string;
  page?: number;
  limit?: number;
}
