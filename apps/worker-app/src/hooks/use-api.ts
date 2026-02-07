"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  ApiResponse,
  PaginatedResponse,
  PostDto,
  PostListDto,
  CreatePostDto,
  UserProfileDto,
} from "@safetywallet/types";

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
      apiFetch<ApiResponse<PostDto>>("/posts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["posts", variables.siteId] });
    },
  });
}

// User Profile
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<ApiResponse<UserProfileDto>>("/users/me"),
  });
}

// Points
export function usePoints(siteId: string) {
  return useQuery({
    queryKey: ["points", siteId],
    queryFn: () =>
      apiFetch<ApiResponse<{ balance: number; history: unknown[] }>>(
        `/points?siteId=${siteId}`,
      ),
    enabled: !!siteId,
  });
}

// Announcements
export function useAnnouncements(siteId: string) {
  return useQuery({
    queryKey: ["announcements", siteId],
    queryFn: () =>
      apiFetch<PaginatedResponse<unknown>>(`/announcements?siteId=${siteId}`),
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
