'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  PostDto,
  PostListDto,
  CreatePostDto,
  UserProfileDto,
} from '@safetywallet/types';

// Posts
export function usePosts(siteId: string) {
  return useQuery({
    queryKey: ['posts', siteId],
    queryFn: () =>
      apiFetch<PaginatedResponse<PostListDto>>(`/posts?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => apiFetch<ApiResponse<PostDto>>(`/posts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostDto) =>
      apiFetch<ApiResponse<PostDto>>('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts', variables.siteId] });
    },
  });
}

// User Profile
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<ApiResponse<UserProfileDto>>('/users/me'),
  });
}

// Points
export function usePoints(siteId: string) {
  return useQuery({
    queryKey: ['points', siteId],
    queryFn: () => apiFetch<ApiResponse<{ balance: number; history: unknown[] }>>(`/points?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

// Announcements
export function useAnnouncements(siteId: string) {
  return useQuery({
    queryKey: ['announcements', siteId],
    queryFn: () => apiFetch<PaginatedResponse<unknown>>(`/announcements?siteId=${siteId}`),
    enabled: !!siteId,
  });
}
