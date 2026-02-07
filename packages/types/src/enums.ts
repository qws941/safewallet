export enum UserRole {
  WORKER = "WORKER",
  SITE_ADMIN = "SITE_ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
  SYSTEM = "SYSTEM",
}

export enum MembershipStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  LEFT = "LEFT",
  REMOVED = "REMOVED",
}

export enum Category {
  HAZARD = "HAZARD",
  UNSAFE_BEHAVIOR = "UNSAFE_BEHAVIOR",
  INCONVENIENCE = "INCONVENIENCE",
  SUGGESTION = "SUGGESTION",
  BEST_PRACTICE = "BEST_PRACTICE",
}

export enum RiskLevel {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum Visibility {
  WORKER_PUBLIC = "WORKER_PUBLIC",
  ADMIN_ONLY = "ADMIN_ONLY",
}

export enum ReviewStatus {
  RECEIVED = "RECEIVED",
  IN_REVIEW = "IN_REVIEW",
  NEED_INFO = "NEED_INFO",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ActionStatus {
  NONE = "NONE",
  REQUIRED = "REQUIRED",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  REOPENED = "REOPENED",
}

export enum ReviewAction {
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  REQUEST_MORE = "REQUEST_MORE",
  MARK_URGENT = "MARK_URGENT",
  ASSIGN = "ASSIGN",
  CLOSE = "CLOSE",
}

export enum TaskStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
}

export enum RejectReason {
  DUPLICATE = "DUPLICATE",
  UNCLEAR_PHOTO = "UNCLEAR_PHOTO",
  INSUFFICIENT = "INSUFFICIENT",
  FALSE = "FALSE",
  IRRELEVANT = "IRRELEVANT",
  OTHER = "OTHER",
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

// === Safety Education (안전교육) ===

export enum EducationContentType {
  VIDEO = "VIDEO",
  IMAGE = "IMAGE",
  TEXT = "TEXT",
  DOCUMENT = "DOCUMENT",
}

export enum QuizStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum StatutoryTrainingType {
  NEW_WORKER = "NEW_WORKER",
  SPECIAL = "SPECIAL",
  REGULAR = "REGULAR",
  CHANGE_OF_WORK = "CHANGE_OF_WORK",
}

export enum TrainingCompletionStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  EXPIRED = "EXPIRED",
}
