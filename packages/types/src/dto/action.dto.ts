import type { ActionStatus, ActionPriority } from "../enums";

export interface CreateActionDto {
  postId: string;
  assigneeType: string;
  assigneeId?: string;
  dueDate?: string;
  priority: ActionPriority;
}

export interface ActionDto {
  id: string;
  postId: string;
  description?: string;
  assigneeType: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  actionStatus: ActionStatus;
  completionNote: string | null;
  completedAt: string | null;
  createdAt: string;
  images: ActionImageDto[];
  assignee?: {
    id: string;
    nameMasked: string | null;
  };
  post?: {
    id: string;
    title?: string;
    category?: string;
  };
}

export interface ActionImageDto {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  imageType: "BEFORE" | "AFTER";
  createdAt: string;
}

export interface UpdateActionStatusDto {
  actionStatus: ActionStatus;
  completionNote?: string;
  imageUrls?: string[];
}
