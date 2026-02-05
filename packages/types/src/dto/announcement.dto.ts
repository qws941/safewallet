export interface CreateAnnouncementDto {
  siteId: string;
  title: string;
  content: string;
  isPinned?: boolean;
}

export interface AnnouncementDto {
  id: string;
  siteId: string;
  authorId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    nameMasked: string | null;
  };
}

export interface UpdateAnnouncementDto {
  title?: string;
  content?: string;
  isPinned?: boolean;
}
