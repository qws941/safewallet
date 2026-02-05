import type { ReviewAction, RejectReason } from '../enums';

export interface ReviewActionDto {
  postId: string;
  action: ReviewAction;
  comment?: string;
  reasonCode?: RejectReason;
}

export interface ReviewDto {
  id: string;
  postId: string;
  adminId: string;
  action: ReviewAction;
  comment: string | null;
  reasonCode: string | null;
  createdAt: string;
  admin: {
    id: string;
    nameMasked: string | null;
  };
}
