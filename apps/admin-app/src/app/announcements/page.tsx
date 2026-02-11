"use client";

import { useState } from "react";
import { Plus, Pin, Edit2, Trash2, Clock } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Badge,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@safetywallet/ui";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from "@/hooks/use-api";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  scheduledAt: string | null;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  createdAt: string;
}

export default function AnnouncementsPage() {
  const { data: announcements = [], isLoading } = useAdminAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setIsPinned(false);
    setScheduledAt("");
  };

  const handleSubmit = () => {
    if (!title || !content) return;

    if (editingId) {
      updateMutation.mutate(
        {
          id: editingId,
          title,
          content,
          isPinned,
          scheduledAt: scheduledAt || null,
        },
        { onSuccess: resetForm },
      );
    } else {
      createMutation.mutate(
        { title, content, isPinned, scheduledAt: scheduledAt || null },
        { onSuccess: resetForm },
      );
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setContent(announcement.content);
    setIsPinned(announcement.isPinned);
    setScheduledAt(
      announcement.scheduledAt
        ? new Date(announcement.scheduledAt).toISOString().slice(0, 16)
        : "",
    );
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId, {
        onSuccess: () => {
          toast({ description: "삭제되었습니다." });
          setDeleteTargetId(null);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            description: "삭제 실패: " + err.message,
          });
          setDeleteTargetId(null);
        },
      });
    }
  };

  const sortedAnnouncements = [...(announcements as Announcement[])].sort(
    (a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">공지사항</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-1">
            <Plus size={16} />새 공지
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "공지 수정" : "새 공지 작성"}
          </h2>
          <div className="space-y-4">
            <Input
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="내용"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">상단 고정</span>
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium">
                예약 발행
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {scheduledAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  설정한 시간에 자동으로 발행됩니다.
                  <button
                    type="button"
                    className="ml-2 text-destructive underline"
                    onClick={() => setScheduledAt("")}
                  >
                    예약 취소
                  </button>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={
                  !title ||
                  !content ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editingId ? "수정" : "등록"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                취소
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground">로딩 중...</p>
      ) : sortedAnnouncements.length === 0 ? (
        <p className="text-center text-muted-foreground">공지사항이 없습니다</p>
      ) : (
        <div className="space-y-4">
          {sortedAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {announcement.isPinned && (
                      <Pin size={16} className="text-primary" />
                    )}
                    <h3 className="font-semibold">{announcement.title}</h3>
                    {announcement.isPinned && (
                      <Badge variant="secondary">고정</Badge>
                    )}
                    {announcement.status === "SCHEDULED" && (
                      <Badge variant="outline" className="gap-1">
                        <Clock size={12} />
                        예약
                      </Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {announcement.content}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {new Date(announcement.createdAt).toLocaleString("ko-KR")}
                    {announcement.scheduledAt && (
                      <span className="ml-2">
                        · 예약:{" "}
                        {new Date(announcement.scheduledAt).toLocaleString(
                          "ko-KR",
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(announcement)}
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(announcement.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
