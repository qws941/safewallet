"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiFetch } from "./use-api-base";
import type {
  Category,
  RejectReason,
  ReviewAction,
  ReviewStatus,
} from "@safetywallet/types";

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
    queryFn: () => apiFetch<Post>(`/admin/posts/${postId}`),
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
