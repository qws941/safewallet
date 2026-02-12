import type { MembershipStatus } from "../enums";

export interface SiteDto {
  id: string;
  name: string;
  active: boolean;
  joinEnabled: boolean;
  requiresApproval: boolean;
  createdAt: string;
  closedAt: string | null;
}

export interface CreateSiteDto {
  name: string;
  requiresApproval?: boolean;
}

export interface SiteMemberDto {
  id: string;
  userId: string;
  siteId: string;
  status: MembershipStatus;
  joinedAt: string;
  leftAt: string | null;
  user: {
    id: string;
    phone: string;
    nameMasked: string | null;
  };
}

export interface UpdateMemberStatusDto {
  status: MembershipStatus;
  reason?: string;
}

export interface DashboardStatsDto {
  pendingReviews: number;
  postsThisWeek: number;
  activeMembers: number;
  totalPoints: number;
}
