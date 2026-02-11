"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type {
  ReviewStatus,
  ReviewAction,
  RejectReason,
  Category,
} from "@safetywallet/types";

// Types
export interface Post {
  id: string;
  category: Category;
  content: string;
  riskLevel?: string;
  status: ReviewStatus;
  actionStatus?: string;
  isUrgent: boolean;
  createdAt: string;
  locationFloor?: string;
  locationZone?: string;
  locationDetail?: string;
  metadata?: Record<string, unknown>;
  images?: Array<{ id: string; fileUrl: string; thumbnailUrl?: string }>;
  reviews?: Array<{
    id: string;
    action: string;
    comment?: string;
    reasonCode?: string;
    createdAt: string;
    admin?: { nameMasked: string };
  }>;
  author: {
    id: string;
    nameMasked: string;
  };
  site?: {
    id: string;
    name: string;
  };
}

interface Member {
  id: string;
  userId: string;
  user: {
    id: string;
    phone: string;
    nameMasked: string;
  };
  status: string;
  role: string;
  pointsBalance: number;
  joinedAt: string;
}

interface PointsEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  member: {
    user: {
      nameMasked: string;
    };
  };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
  actor: {
    nameMasked: string;
  };
}

interface DashboardStats {
  pendingReviews: number;
  postsThisWeek: number;
  activeMembers: number;
  totalPoints: number;
  pendingCount: number;
  urgentCount: number;
  avgProcessingHours: number;
  categoryDistribution: Record<string, number>;
  todayPostsCount: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AttendanceLogsParams {
  date?: string;
  result?: "SUCCESS" | "FAIL";
  page?: number;
  limit?: number;
}

export interface AttendanceLogItem {
  id: string;
  siteId: string;
  userId: string | null;
  externalWorkerId: string | null;
  checkinAt: string;
  result: "SUCCESS" | "FAIL";
  source: "FAS" | "MANUAL";
  createdAt: string;
  userName: string | null;
}

export interface AttendanceLogsResponse {
  logs: AttendanceLogItem[];
  pagination: PaginationMeta;
}

export interface UnmatchedWorkersParams {
  date?: string;
  page?: number;
  limit?: number;
}

export interface UnmatchedWorkerItem {
  id: string;
  externalWorkerId: string | null;
  siteId: string;
  siteName: string | null;
  checkinAt: string;
  source: "FAS" | "MANUAL";
  createdAt: string;
}

export interface UnmatchedWorkersResponse {
  records: UnmatchedWorkerItem[];
  pagination: PaginationMeta;
}

// Dashboard
export function useDashboardStats() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["dashboard", "stats", siteId],
    queryFn: () => apiFetch<DashboardStats>(`/sites/${siteId}/stats`),
    enabled: !!siteId,
    refetchInterval: 30_000,
  });
}

// Posts
export interface PostFilters {
  siteId?: string;
  category?: Category;
  riskLevel?: string;
  reviewStatus?: ReviewStatus;
  isUrgent?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export function useAdminPosts(filters: PostFilters) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const siteId = filters.siteId || currentSiteId;

  const params = new URLSearchParams();
  if (siteId) params.set("siteId", siteId);
  if (filters.category) params.set("category", filters.category);
  if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
  if (filters.reviewStatus) params.set("reviewStatus", filters.reviewStatus);
  if (filters.isUrgent) params.set("isUrgent", "true");
  if (filters.startDate)
    params.set("startDate", filters.startDate.toISOString());
  if (filters.endDate) params.set("endDate", filters.endDate.toISOString());

  return useQuery({
    queryKey: ["admin", "posts", siteId, filters],
    queryFn: () =>
      apiFetch<{ posts: Post[] }>(`/admin/posts?${params.toString()}`).then(
        (res) => res.posts,
      ),
    enabled: !!siteId,
  });
}

export function useAdminPost(postId: string) {
  return useQuery({
    queryKey: ["admin", "post", postId],
    queryFn: () => apiFetch<Post>(`/posts/${postId}`),
    enabled: !!postId,
  });
}

export function useReviewPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      action,
      reason,
      comment,
    }: {
      postId: string;
      action: ReviewAction;
      reason?: RejectReason;
      comment?: string;
    }) =>
      apiFetch(`/reviews`, {
        method: "POST",
        body: JSON.stringify({ postId, action, reason, comment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Actions
export function useCreateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      assigneeId,
      dueDate,
      description,
      priority,
    }: {
      postId: string;
      assigneeId: string;
      dueDate: string;
      description?: string;
      priority?: string;
    }) =>
      apiFetch(`/actions`, {
        method: "POST",
        body: JSON.stringify({
          postId,
          assigneeType: "USER",
          assigneeId,
          dueDate,
          description,
          priority,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "post"] });
    },
  });
}

// Members
export function useMembers(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "members", targetSiteId],
    queryFn: () => apiFetch<Member[]>(`/sites/${targetSiteId}/members`),
    enabled: !!targetSiteId,
  });
}

export function useMember(memberId: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "member", siteId, memberId],
    queryFn: () => apiFetch<Member>(`/sites/${siteId}/members/${memberId}`),
    enabled: !!siteId && !!memberId,
  });
}

// Points
export function usePointsLedger() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "points", siteId],
    queryFn: () => apiFetch<PointsEntry[]>(`/points/history?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function useAwardPoints() {
  const queryClient = useQueryClient();
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({
      memberId,
      amount,
      reason,
    }: {
      memberId: string;
      amount: number;
      reason: string;
    }) =>
      apiFetch(`/points/award`, {
        method: "POST",
        body: JSON.stringify({ siteId, memberId, amount, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "points"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    },
  });
}

// Announcements
export function useAdminAnnouncements() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "announcements", siteId],
    queryFn: () => apiFetch<Announcement[]>(`/announcements?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({
      title,
      content,
      isPinned,
    }: {
      title: string;
      content: string;
      isPinned?: boolean;
    }) =>
      apiFetch(`/announcements`, {
        method: "POST",
        body: JSON.stringify({ siteId, title, content, isPinned }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      title,
      content,
      isPinned,
    }: {
      id: string;
      title: string;
      content: string;
      isPinned?: boolean;
    }) =>
      apiFetch(`/announcements/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, content, isPinned }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/announcements/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

// Audit Logs
// Note: Audit logs endpoint not implemented yet - placeholder for future
export function useAuditLogs() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "audit", siteId],
    queryFn: () => Promise.resolve([] as AuditLog[]),
    enabled: !!siteId,
  });
}

// Actions
interface ActionItem {
  id: string;
  postId: string;
  description: string;
  status: string;
  assignee?: {
    nameMasked: string;
  };
  dueDate?: string;
  createdAt: string;
}

export interface ManualApproval {
  id: string;
  userId: string;
  siteId: string;
  approvedById?: string;
  reason: string;
  validDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    companyName: string | null;
    tradeType: string | null;
  };
  approvedBy?: {
    id: string;
    name: string | null;
  };
}

export interface SiteMembership {
  id: string;
  siteId: string;
  siteName: string;
  status: string;
  role: string;
  joinedAt: string;
}

export function useMySites() {
  return useQuery({
    queryKey: ["admin", "my-sites"],
    queryFn: () => apiFetch<SiteMembership[]>("/users/me/memberships"),
  });
}

export function useManualApprovals(
  siteId?: string,
  date?: string,
  status?: string,
) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  const params = new URLSearchParams();
  if (targetSiteId) params.set("siteId", targetSiteId);
  if (date) params.set("date", date);
  if (status) params.set("status", status);

  return useQuery({
    queryKey: ["admin", "manual-approvals", targetSiteId, date, status],
    queryFn: () =>
      apiFetch<ManualApproval[]>(`/approvals?${params.toString()}`),
    enabled: !!targetSiteId,
  });
}

export function useApproveManualRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/approvals/${id}/approve`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "manual-approvals"],
      });
    },
  });
}

export function useRejectManualRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/approvals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "manual-approvals"],
      });
    },
  });
}

export function useCreateManualApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      userId: string;
      siteId: string;
      reason: string;
      validDate: string;
    }) =>
      apiFetch("/admin/manual-approval", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "manual-approvals", variables.siteId],
      });
    },
  });
}

export function useActionItems() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "actions", siteId],
    queryFn: () => apiFetch<ActionItem[]>(`/actions?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/actions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "actions"] });
    },
  });
}

export function useAttendanceLogs(
  siteId?: string,
  params?: AttendanceLogsParams,
) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "attendance-logs", targetSiteId, params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (targetSiteId) query.set("siteId", targetSiteId);
      if (params?.date) query.set("date", params.date);
      if (params?.result) query.set("result", params.result);
      if (params?.page !== undefined) query.set("page", String(params.page));
      if (params?.limit !== undefined) {
        query.set("limit", String(params.limit));
      }

      const response = await apiFetch<
        AttendanceLogsResponse | { data: AttendanceLogsResponse }
      >(`/admin/attendance-logs?${query.toString()}`);

      return "data" in response ? response.data : response;
    },
    enabled: !!targetSiteId,
  });
}

export function useUnmatchedWorkers(
  siteId?: string,
  params?: UnmatchedWorkersParams,
) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "attendance-unmatched", targetSiteId, params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (targetSiteId) query.set("siteId", targetSiteId);
      if (params?.date) query.set("date", params.date);
      if (params?.page !== undefined) query.set("page", String(params.page));
      if (params?.limit !== undefined) {
        query.set("limit", String(params.limit));
      }

      const response = await apiFetch<
        UnmatchedWorkersResponse | { data: UnmatchedWorkersResponse }
      >(`/admin/attendance/unmatched?${query.toString()}`);

      return "data" in response ? response.data : response;
    },
    enabled: !!targetSiteId,
  });
}

// Site Settings
export interface Site {
  id: string;
  name: string;
  active: boolean;
  joinCode: string;
  joinEnabled?: boolean;
  createdAt: string;
  memberCount?: number;
}

export function useSite(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["site", targetSiteId],
    queryFn: async () => {
      const response = await apiFetch<{ site: Site }>(`/sites/${targetSiteId}`);
      return response.site;
    },
    enabled: !!targetSiteId,
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      siteId,
      data,
    }: {
      siteId: string;
      data: { name?: string; active?: boolean };
    }) =>
      apiFetch<{ site: Site }>(`/sites/${siteId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["site", variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "my-sites"] });
    },
  });
}

export function useReissueJoinCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (siteId: string) =>
      apiFetch<{ site: Site; previousCode: string }>(
        `/sites/${siteId}/reissue-join-code`,
        { method: "POST" },
      ),
    onSuccess: (_, siteId) => {
      queryClient.invalidateQueries({ queryKey: ["site", siteId] });
    },
  });
}

// Point Policies
export interface PointPolicy {
  id: string;
  siteId: string;
  reasonCode: string;
  name: string;
  description: string | null;
  defaultAmount: number;
  minAmount: number | null;
  maxAmount: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyBody {
  siteId: string;
  reasonCode: string;
  name: string;
  description?: string;
  defaultAmount: number;
  minAmount?: number;
  maxAmount?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface UpdatePolicyBody {
  name?: string;
  description?: string;
  defaultAmount?: number;
  minAmount?: number;
  maxAmount?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  isActive?: boolean;
}

export function usePolicies(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "policies", targetSiteId],
    queryFn: () =>
      apiFetch<{ policies: PointPolicy[] }>(
        `/policies/site/${targetSiteId}`,
      ).then((res) => res.policies),
    enabled: !!targetSiteId,
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: (
      data: Omit<CreatePolicyBody, "siteId"> & { siteId?: string },
    ) => {
      const siteId = data.siteId || currentSiteId;
      if (!siteId) throw new Error("Site ID is required");

      return apiFetch<{ policy: PointPolicy }>("/policies", {
        method: "POST",
        body: JSON.stringify({ ...data, siteId }),
      });
    },
    onSuccess: (_, variables) => {
      const siteId = variables.siteId || currentSiteId;
      queryClient.invalidateQueries({
        queryKey: ["admin", "policies", siteId],
      });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePolicyBody }) =>
      apiFetch<{ policy: PointPolicy }>(`/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "policy", data.policy.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "policies", data.policy.siteId],
      });
      if (currentSiteId) {
        queryClient.invalidateQueries({
          queryKey: ["admin", "policies", currentSiteId],
        });
      }
    },
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/policies/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      if (currentSiteId) {
        queryClient.invalidateQueries({
          queryKey: ["admin", "policies", currentSiteId],
        });
      }
    },
  });
}

// Education
export interface EducationContent {
  id: string;
  siteId: string;
  title: string;
  description: string | null;
  contentType: "VIDEO" | "IMAGE" | "TEXT" | "DOCUMENT";
  contentUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface EducationContentsResponse {
  contents: EducationContent[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateEducationContentInput {
  siteId: string;
  title: string;
  contentType: "VIDEO" | "IMAGE" | "TEXT" | "DOCUMENT";
  description?: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
}

export interface Quiz {
  id: string;
  siteId: string;
  contentId: string | null;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  pointsReward: number;
  passingScore: number;
  timeLimitMinutes: number | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizWithQuestions extends Quiz {
  questions: QuizQuestion[];
}

export interface QuizzesResponse {
  quizzes: Quiz[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateQuizInput {
  siteId: string;
  title: string;
  contentId?: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  pointsReward?: number;
  passingScore?: number;
  timeLimitMinutes?: number;
}

export interface CreateQuizQuestionInput {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  orderIndex?: number;
}

export interface UpdateQuizQuestionInput {
  question?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  orderIndex?: number;
}

export interface StatutoryTraining {
  id: string;
  siteId: string;
  userId: string;
  trainingType: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK";
  trainingName: string;
  trainingDate: string;
  expirationDate: string | null;
  provider: string | null;
  certificateUrl: string | null;
  hoursCompleted: number;
  status: "SCHEDULED" | "COMPLETED" | "EXPIRED";
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatutoryTrainingRow {
  training: StatutoryTraining;
  userName: string | null;
}

export interface StatutoryTrainingsResponse {
  trainings: StatutoryTrainingRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateStatutoryTrainingInput {
  siteId: string;
  userId: string;
  trainingType: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK";
  trainingName: string;
  trainingDate: string;
  expirationDate?: string;
  provider?: string;
  certificateUrl?: string;
  hoursCompleted?: number;
  status?: "SCHEDULED" | "COMPLETED" | "EXPIRED";
  notes?: string;
}

export interface UpdateStatutoryTrainingInput {
  trainingType?: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK";
  trainingName?: string;
  trainingDate?: string;
  expirationDate?: string;
  provider?: string;
  certificateUrl?: string;
  hoursCompleted?: number;
  status?: "SCHEDULED" | "COMPLETED" | "EXPIRED";
  notes?: string;
}

export interface TbmRecord {
  id: string;
  siteId: string;
  date: string;
  topic: string;
  content: string | null;
  leaderId: string;
  weatherCondition: string | null;
  specialNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TbmRecordRow {
  tbm: TbmRecord;
  leaderName: string | null;
}

export interface TbmRecordsResponse {
  records: TbmRecordRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface TbmAttendee {
  attendee: {
    id: string;
    tbmRecordId: string;
    userId: string;
    attendedAt: string;
  };
  userName: string | null;
}

export interface TbmRecordDetail extends TbmRecord {
  leaderName: string | null;
  attendees: TbmAttendee[];
  attendeeCount: number;
}

export interface CreateTbmRecordInput {
  siteId: string;
  date: string;
  topic: string;
  content?: string;
  leaderId?: string;
  weatherCondition?: string;
  specialNotes?: string;
}

export function useEducationContents(filters?: {
  limit?: number;
  offset?: number;
}) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "education-contents", siteId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (filters?.limit !== undefined) {
        params.set("limit", String(filters.limit));
      }
      if (filters?.offset !== undefined) {
        params.set("offset", String(filters.offset));
      }

      return apiFetch<EducationContentsResponse>(
        `/education/contents?${params.toString()}`,
      );
    },
    enabled: !!siteId,
  });
}

export function useEducationContent(id: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "education-content", siteId, id],
    queryFn: () => apiFetch<EducationContent>(`/education/contents/${id}`),
    enabled: !!siteId && !!id,
  });
}

export function useCreateEducationContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEducationContentInput) =>
      apiFetch<EducationContent>("/education/contents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "education-contents"],
      });
    },
  });
}

export function useDeleteEducationContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/education/contents/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "education-contents"],
      });
    },
  });
}

export function useQuizzes(filters?: {
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  limit?: number;
  offset?: number;
}) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "quizzes", siteId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.limit !== undefined) {
        params.set("limit", String(filters.limit));
      }
      if (filters?.offset !== undefined) {
        params.set("offset", String(filters.offset));
      }

      return apiFetch<QuizzesResponse>(
        `/education/quizzes?${params.toString()}`,
      );
    },
    enabled: !!siteId,
  });
}

export function useQuiz(id: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "quiz", siteId, id],
    queryFn: () => apiFetch<QuizWithQuestions>(`/education/quizzes/${id}`),
    enabled: !!siteId && !!id,
  });
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuizInput) =>
      apiFetch<Quiz>("/education/quizzes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
    },
  });
}

export function useCreateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      data,
    }: {
      quizId: string;
      data: CreateQuizQuestionInput;
    }) =>
      apiFetch<QuizQuestion>(`/education/quizzes/${quizId}/questions`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
    },
  });
}

export function useUpdateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      questionId,
      data,
    }: {
      quizId: string;
      questionId: string;
      data: UpdateQuizQuestionInput;
    }) =>
      apiFetch<QuizQuestion>(
        `/education/quizzes/${quizId}/questions/${questionId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
    },
  });
}

export function useDeleteQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      questionId,
    }: {
      quizId: string;
      questionId: string;
    }) =>
      apiFetch<{ deleted: boolean }>(
        `/education/quizzes/${quizId}/questions/${questionId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "quizzes"] });
    },
  });
}

export function useStatutoryTrainings(filters?: {
  userId?: string;
  trainingType?: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK";
  status?: "SCHEDULED" | "COMPLETED" | "EXPIRED";
  limit?: number;
  offset?: number;
}) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "statutory-trainings", siteId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (filters?.userId) params.set("userId", filters.userId);
      if (filters?.trainingType) {
        params.set("trainingType", filters.trainingType);
      }
      if (filters?.status) params.set("status", filters.status);
      if (filters?.limit !== undefined) {
        params.set("limit", String(filters.limit));
      }
      if (filters?.offset !== undefined) {
        params.set("offset", String(filters.offset));
      }

      return apiFetch<StatutoryTrainingsResponse>(
        `/education/statutory?${params.toString()}`,
      );
    },
    enabled: !!siteId,
  });
}

export function useCreateStatutoryTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStatutoryTrainingInput) =>
      apiFetch<StatutoryTraining>("/education/statutory", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "statutory-trainings"],
      });
    },
  });
}

export function useUpdateStatutoryTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateStatutoryTrainingInput;
    }) =>
      apiFetch<StatutoryTraining>(`/education/statutory/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "statutory-trainings"],
      });
    },
  });
}

export function useTbmRecords(filters?: {
  date?: string;
  limit?: number;
  offset?: number;
}) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "tbm-records", siteId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (filters?.date) params.set("date", filters.date);
      if (filters?.limit !== undefined) {
        params.set("limit", String(filters.limit));
      }
      if (filters?.offset !== undefined) {
        params.set("offset", String(filters.offset));
      }

      return apiFetch<TbmRecordsResponse>(
        `/education/tbm?${params.toString()}`,
      );
    },
    enabled: !!siteId,
  });
}

export function useTbmRecord(id: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "tbm-record", siteId, id],
    queryFn: () => apiFetch<TbmRecordDetail>(`/education/tbm/${id}`),
    enabled: !!siteId && !!id,
  });
}

export function useCreateTbmRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTbmRecordInput) =>
      apiFetch<TbmRecord>("/education/tbm", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tbm-records"] });
    },
  });
}
