'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePosts } from '@/hooks/use-api';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { PostCard } from '@/components/post-card';
import { Skeleton } from '@safetywallet/ui';

export default function PostsPage() {
  const { currentSiteId } = useAuth();
  const { data, isLoading } = usePosts(currentSiteId || '');

  const posts = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />
      
      <main className="p-4">
        <h2 className="text-lg font-bold mb-4">내 제보 목록</h2>
        
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : posts.length > 0 ? (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
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
