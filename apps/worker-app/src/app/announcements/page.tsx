'use client';

import { useAuth } from '@/hooks/use-auth';
import { useAnnouncements } from '@/hooks/use-api';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@safetywallet/ui';

export default function AnnouncementsPage() {
  const { currentSiteId } = useAuth();
  const { data, isLoading } = useAnnouncements(currentSiteId || '');

  const announcements = (data?.data || []) as Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    isPinned?: boolean;
  }>;

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />
      
      <main className="p-4">
        <h2 className="text-lg font-bold mb-4">공지사항</h2>
        
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : announcements.length > 0 ? (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className={announcement.isPinned ? 'border-primary' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {announcement.isPinned && (
                      <span className="text-sm">📌</span>
                    )}
                    <CardTitle className="text-base">{announcement.title}</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(announcement.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-4xl mb-4">📣</p>
            <p>공지사항이 없습니다.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
