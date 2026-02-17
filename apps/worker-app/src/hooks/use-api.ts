"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type {
  ApiResponse,
  PaginatedResponse,
  PostDto,
  PostListDto,
  CreatePostDto,
  UserProfileDto,
  ActionDto,
  UpdateActionStatusDto,
  PointsHistoryItemDto,
  AnnouncementDto,
} from "@safetywallet/types";

// System Status
interface SystemNotice {
  type: "fas_down" | "maintenance" | "info";
  message: string;
  severity: "warning" | "critical" | "info";
}

interface SystemStatusResponse {
  success: boolean;
  data: { notices: SystemNotice[]; hasIssues: boolean };
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: () =>
      apiFetch<SystemStatusResponse>("/system/status", { skipAuth: true }),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

// Posts
export function usePosts(siteId: string) {
  return useQuery({
    queryKey: ["posts", siteId],
    queryFn: () =>
      apiFetch<PaginatedResponse<PostListDto>>(`/posts?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: () => apiFetch<ApiResponse<PostDto>>(`/posts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostDto) =>
      apiFetch<ApiResponse<{ post: PostDto }>>("/posts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["posts", variables.siteId] });
    },
  });
}

// Site Info
export function useSiteInfo(siteId: string | null) {
  return useQuery({
    queryKey: ["site", siteId],
    queryFn: () =>
      apiFetch<
        ApiResponse<{
          site: {
            id: string;
            name: string;
            address: string | null;
            memberCount: number;
          };
        }>
      >(`/sites/${siteId}`),
    enabled: !!siteId,
    staleTime: 1000 * 60 * 10,
  });
}

// User Profile
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<ApiResponse<{ user: UserProfileDto }>>("/users/me"),
  });
}

// Points
export function usePoints(siteId: string) {
  return useQuery({
    queryKey: ["points", siteId],
    queryFn: () =>
      apiFetch<
        ApiResponse<{ balance: number; history: PointsHistoryItemDto[] }>
      >(`/points?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

// Announcements
export function useAnnouncements(siteId: string) {
  return useQuery({
    queryKey: ["announcements", siteId],
    queryFn: () =>
      apiFetch<PaginatedResponse<AnnouncementDto>>(
        `/announcements?siteId=${siteId}`,
      ),
    enabled: !!siteId,
  });
}

// Education Contents
export function useEducationContents(siteId: string) {
  return useQuery({
    queryKey: ["education-contents", siteId],
    queryFn: () =>
      apiFetch<{
        contents: Array<{
          id: string;
          siteId: string;
          title: string;
          content: string;
          contentType: string;
          category: string;
          isRequired: boolean;
          displayOrder: number;
          createdAt: string;
          contentUrl?: string;
          thumbnailUrl?: string;
          description?: string;
        }>;
      }>(`/education/contents?siteId=${siteId}`).then((r) => r.contents),
    enabled: !!siteId,
  });
}

export function useEducationContent(id: string) {
  return useQuery({
    queryKey: ["education-content", id],
    queryFn: () =>
      apiFetch<{
        content: {
          id: string;
          title: string;
          content: string;
          contentType: string;
          category: string;
          isRequired: boolean;
          createdAt: string;
          contentUrl?: string;
          thumbnailUrl?: string;
          description?: string;
        };
      }>(`/education/contents/${id}`).then((r) => r.content),
    enabled: !!id,
  });
}

// Quizzes
export function useQuizzes(siteId: string) {
  return useQuery({
    queryKey: ["quizzes", siteId],
    queryFn: () =>
      apiFetch<{
        quizzes: Array<{
          id: string;
          title: string;
          description: string | null;
          passingScore: number;
          timeLimitMinutes: number | null;
          maxAttempts: number;
          isActive: boolean;
          createdAt: string;
          questions?: Array<{
            id: string;
            question: string;
            options: string;
            correctAnswer: number;
            explanation: string | null;
            displayOrder: number;
          }>;
        }>;
      }>(`/education/quizzes?siteId=${siteId}`).then((r) => r.quizzes),
    enabled: !!siteId,
  });
}

export function useQuiz(id: string) {
  return useQuery({
    queryKey: ["quiz", id],
    queryFn: () =>
      apiFetch<{
        quiz: {
          id: string;
          title: string;
          description: string | null;
          passingScore: number;
          timeLimitMinutes: number | null;
          maxAttempts: number;
          questions: Array<{
            id: string;
            question: string;
            options: string;
            correctAnswer: number;
            explanation: string | null;
            displayOrder: number;
          }>;
        };
      }>(`/education/quizzes/${id}`).then((r) => r.quiz),
    enabled: !!id,
  });
}

export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quizId,
      answers,
    }: {
      quizId: string;
      answers: Record<string, number>;
    }) =>
      apiFetch<{
        attempt: {
          id: string;
          score: number;
          passed: boolean;
          totalQuestions: number;
          correctAnswers: number;
        };
      }>(`/education/quizzes/${quizId}/attempt`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["quiz-attempts", variables.quizId],
      });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });
}

export function useMyQuizAttempts(quizId: string) {
  return useQuery({
    queryKey: ["quiz-attempts", quizId],
    queryFn: () =>
      apiFetch<{
        attempts: Array<{
          id: string;
          score: number;
          passed: boolean;
          totalQuestions: number;
          correctAnswers: number;
          createdAt: string;
        }>;
      }>(`/education/quizzes/${quizId}/my-attempts`).then((r) => r.attempts),
    enabled: !!quizId,
  });
}

// TBM
export function useTbmRecords(siteId: string) {
  return useQuery({
    queryKey: ["tbm-records", siteId],
    queryFn: () =>
      apiFetch<{
        records: Array<{
          id: string;
          title: string;
          date: string;
          location: string | null;
          content: string | null;
          safetyTopic: string | null;
          leader?: { nameMasked: string };
          _count?: { attendees: number };
        }>;
      }>(`/education/tbm?siteId=${siteId}`).then((r) => r.records),
    enabled: !!siteId,
  });
}

export function useAttendTbm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tbmId: string) =>
      apiFetch(`/education/tbm/${tbmId}/attend`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tbm-records"] });
    },
  });
}

// ============================================================
// 출근 확인 (Attendance Check)
// ============================================================

interface AttendanceStatus {
  attended: boolean;
  checkinAt: string | null;
}

export function useAttendanceToday(siteId: string | null) {
  return useQuery({
    queryKey: ["attendance", "today", siteId],
    queryFn: () =>
      apiFetch<AttendanceStatus>(`/attendance/today?siteId=${siteId}`),
    enabled: !!siteId,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}

// ============================================================
// 시정조치 (Corrective Actions)
// ============================================================

export function useMyActions(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["actions", "my", params],
    queryFn: () =>
      apiFetch<PaginatedResponse<ActionDto>>(
        `/actions/my${qs ? `?${qs}` : ""}`,
      ),
    staleTime: 1000 * 60 * 2,
  });
}

export function useAction(actionId: string | null) {
  return useQuery({
    queryKey: ["actions", actionId],
    queryFn: () => apiFetch<ApiResponse<ActionDto>>(`/actions/${actionId}`),
    enabled: !!actionId,
  });
}

export function useUpdateActionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      data,
    }: {
      actionId: string;
      data: UpdateActionStatusDto;
    }) =>
      apiFetch<ApiResponse<ActionDto>>(`/actions/${actionId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({
        queryKey: ["actions", variables.actionId],
      });
    },
  });
}

export function useUploadActionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      formData,
    }: {
      actionId: string;
      formData: FormData;
    }) =>
      apiFetch<ApiResponse<{ id: string; fileUrl: string }>>(
        `/actions/${actionId}/images`,
        {
          method: "POST",
          body: formData,
        },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["actions", variables.actionId],
      });
    },
  });
}

// Leave site
export function useLeaveSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteId, reason }: { siteId: string; reason?: string }) =>
      apiFetch<ApiResponse<{ message: string }>>(`/sites/${siteId}/leave`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ─── Recommendations ───────────────────────────────────────

export function useTodayRecommendation() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  return useQuery<
    ApiResponse<{
      hasRecommendedToday: boolean;
      recommendation: unknown | null;
    }>
  >({
    queryKey: ["recommendations", "today", currentSiteId],
    queryFn: () =>
      apiFetch<
        ApiResponse<{
          hasRecommendedToday: boolean;
          recommendation: unknown | null;
        }>
      >(`/recommendations/today?siteId=${currentSiteId}`),
    enabled: !!currentSiteId,
  });
}

export function useRecommendationHistory() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  return useQuery<ApiResponse<{ items: unknown[] }>>({
    queryKey: ["recommendations", "history", currentSiteId],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: unknown[] }>>(
        `/recommendations/history?siteId=${currentSiteId}`,
      ),
    enabled: !!currentSiteId,
  });
}

export function useSubmitRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      recommendedName: string;
      tradeType: string;
      reason: string;
      siteId: string;
    }) =>
      apiFetch<ApiResponse<{ id: string }>>("/recommendations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}

export function useDeleteActionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      imageId,
    }: {
      actionId: string;
      imageId: string;
    }) =>
      apiFetch<ApiResponse<null>>(`/actions/${actionId}/images/${imageId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["actions", variables.actionId],
      });
    },
  });
}
