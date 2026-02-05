import type { TaskStatus } from '../enums';

export interface CreateActionDto {
  postId: string;
  assigneeType: string;
  assigneeId?: string;
  dueDate?: string;
}

export interface ActionDto {
  id: string;
  postId: string;
  assigneeType: string;
  assigneeId: string | null;
  dueDate: string | null;
  actionStatus: TaskStatus;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  images: ActionImageDto[];
  assignee?: {
    id: string;
    nameMasked: string | null;
  };
}

export interface ActionImageDto {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
}

export interface UpdateActionStatusDto {
  actionStatus: TaskStatus;
  completionNote?: string;
  imageUrls?: string[];
}
