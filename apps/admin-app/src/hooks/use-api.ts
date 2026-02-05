'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type {
  ReviewStatus,
  ReviewAction,
  RejectReason,
  Category,
} from '@safetywallet/types';

// Types
interface Post {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: ReviewStatus;
  createdAt: string;
  author: {
    id: string;
    nameMasked: string;
  };
  photos: string[];
  location?: string;
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
}

// Dashboard
export function useDashboardStats() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['dashboard', 'stats', siteId],
    queryFn: () => apiFetch<DashboardStats>(`/sites/${siteId}/stats`),
    enabled: !!siteId,
  });
}

// Posts
export function useAdminPosts(status?: ReviewStatus) {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const params = new URLSearchParams();
  if (siteId) params.set('siteId', siteId);
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['admin', 'posts', siteId, status],
    queryFn: () => apiFetch<Post[]>(`/posts?${params.toString()}`),
    enabled: !!siteId,
  });
}

export function useAdminPost(postId: string) {
  return useQuery({
    queryKey: ['admin', 'post', postId],
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
      note,
    }: {
      postId: string;
      action: ReviewAction;
      reason?: RejectReason;
      note?: string;
    }) =>
      apiFetch(`/reviews`, {
        method: 'POST',
        body: JSON.stringify({ postId, action, reason, note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Members
export function useMembers() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['admin', 'members', siteId],
    queryFn: () => apiFetch<Member[]>(`/sites/${siteId}/members`),
    enabled: !!siteId,
  });
}

export function useMember(memberId: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['admin', 'member', siteId, memberId],
    queryFn: () => apiFetch<Member>(`/sites/${siteId}/members/${memberId}`),
    enabled: !!siteId && !!memberId,
  });
}

// Points
export function usePointsLedger() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['admin', 'points', siteId],
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
        method: 'POST',
        body: JSON.stringify({ siteId, memberId, amount, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'points'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
    },
  });
}

// Announcements
export function useAdminAnnouncements() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['admin', 'announcements', siteId],
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
        method: 'POST',
        body: JSON.stringify({ siteId, title, content, isPinned }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
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
        method: 'PUT',
        body: JSON.stringify({ title, content, isPinned }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/announcements/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

// Audit Logs
// Note: Audit logs endpoint not implemented yet - placeholder for future
export function useAuditLogs() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['admin', 'audit', siteId],
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

export function useActionItems() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ['admin', 'actions', siteId],
    queryFn: () => apiFetch<ActionItem[]>(`/actions?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
    },
  });
}
