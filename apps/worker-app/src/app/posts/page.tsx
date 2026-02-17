"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
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

export default function PostsPage() {
  const { currentSiteId } = useAuth();
  const t = useTranslation();

  const statusFilters: Array<{ label: string; value: string | null }> = [
    { label: t("posts.pageList.all"), value: null },
    { label: t("posts.pageList.urgent"), value: ReviewStatus.URGENT },
    { label: t("posts.pageList.received"), value: ReviewStatus.PENDING },
    { label: t("posts.pageList.inReview"), value: ReviewStatus.IN_REVIEW },
    { label: t("posts.pageList.approved"), value: ReviewStatus.APPROVED },
    { label: t("posts.pageList.rejected"), value: ReviewStatus.REJECTED },
    { label: t("posts.pageList.needInfo"), value: ReviewStatus.NEED_INFO },
  ];
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
          <h2 className="text-lg font-bold">
            {t("posts.pageList.myReportsList")}
          </h2>
          <Link href="/posts/new">
            <Button size="sm" type="button" className="gap-1">
              <Plus className="w-4 h-4" />
              {t("posts.pageList.newReport")}
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
            <p>{t("posts.pageList.noReportsYet")}</p>
            <p className="text-sm mt-2">{t("posts.pageList.findHazards")}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
