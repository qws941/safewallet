"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { PostCard } from "@/components/post-card";
import { Skeleton, Button } from "@safetywallet/ui";
import { ReviewStatus } from "@safetywallet/types";
import type { PostListDto } from "@safetywallet/types";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus } from "lucide-react";

const statusFilters: Array<{ label: string; value: string | null }> = [
  { label: "전체", value: null },
  { label: "접수", value: ReviewStatus.RECEIVED },
  { label: "검토중", value: ReviewStatus.IN_REVIEW },
  { label: "승인", value: ReviewStatus.APPROVED },
  { label: "반려", value: ReviewStatus.REJECTED },
  { label: "추가정보", value: ReviewStatus.NEED_INFO },
];

export default function PostsPage() {
  const { currentSiteId } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["posts", "me", currentSiteId, activeFilter],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams();
        if (currentSiteId) params.set("siteId", currentSiteId);
        if (activeFilter) params.set("reviewStatus", activeFilter);
        if (pageParam) params.set("cursor", pageParam);
        params.set("limit", "20");
        const res = await apiFetch(`/posts/me?${params.toString()}`);
        return res as {
          data?: {
            nextCursor?: string;
            items?: PostListDto[];
          };
        };
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: { data?: { nextCursor?: string } }) =>
        lastPage?.data?.nextCursor ?? undefined,
      enabled: !!currentSiteId,
    });

  const posts: PostListDto[] =
    data?.pages.flatMap((page) => page?.data?.items || []) || [];

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">내 제보 목록</h2>
          <Link href="/posts/new">
            <Button size="sm" type="button" className="gap-1">
              <Plus className="w-4 h-4" />새 제보
            </Button>
          </Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {statusFilters.map((filter) => (
            <button
              type="button"
              key={filter.value ?? "all"}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground border",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-1">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={observerRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-4xl mb-4">📝</p>
            <p>아직 제보한 내역이 없습니다.</p>
            <p className="text-sm mt-2">위험요소를 발견하면 제보해주세요!</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
