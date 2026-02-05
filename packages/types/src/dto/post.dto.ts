import type {
  Category,
  RiskLevel,
  Visibility,
  ReviewStatus,
  ActionStatus,
} from '../enums';

export interface CreatePostDto {
  siteId: string;
  category: Category;
  hazardType?: string;
  riskLevel?: RiskLevel;
  locationFloor?: string;
  locationZone?: string;
  locationDetail?: string;
  content: string;
  visibility?: Visibility;
  isAnonymous?: boolean;
  imageUrls?: string[];
}

export interface PostDto {
  id: string;
  userId: string;
  siteId: string;
  category: Category;
  hazardType: string | null;
  riskLevel: RiskLevel | null;
  locationFloor: string | null;
  locationZone: string | null;
  locationDetail: string | null;
  content: string;
  visibility: Visibility;
  isAnonymous: boolean;
  reviewStatus: ReviewStatus;
  actionStatus: ActionStatus;
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  images: PostImageDto[];
  author?: {
    id: string;
    nameMasked: string | null;
  };
}

export interface PostImageDto {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
}

export interface PostListDto {
  id: string;
  category: Category;
  content: string;
  reviewStatus: ReviewStatus;
  actionStatus: ActionStatus;
  isUrgent: boolean;
  createdAt: string;
  imageCount: number;
  author?: {
    nameMasked: string | null;
  };
}

export interface PostFilterDto {
  siteId: string;
  category?: Category;
  reviewStatus?: ReviewStatus;
  actionStatus?: ActionStatus;
  isUrgent?: boolean;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}
