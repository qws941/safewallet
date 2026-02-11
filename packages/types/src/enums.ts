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
  PENDING = "PENDING",
  IN_REVIEW = "IN_REVIEW",
  NEED_INFO = "NEED_INFO",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  URGENT = "URGENT",
}

export enum ActionStatus {
  NONE = "NONE",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  VERIFIED = "VERIFIED",
  OVERDUE = "OVERDUE",
}

export enum ActionPriority {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
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

// === Site Membership (현장 멤버십) ===

export enum MembershipRole {
  WORKER = "WORKER",
  SITE_ADMIN = "SITE_ADMIN",
}

// === Attendance (출석) ===

export enum AttendanceResult {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
}

export enum AttendanceSource {
  FAS = "FAS",
  MANUAL = "MANUAL",
}

// === Votes (투표) ===

export enum VoteCandidateSource {
  ADMIN = "ADMIN",
  AUTO = "AUTO",
}

// === Disputes (이의신청) ===

export enum DisputeStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}

export enum DisputeType {
  REVIEW_APPEAL = "REVIEW_APPEAL",
  POINT_DISPUTE = "POINT_DISPUTE",
  ATTENDANCE_DISPUTE = "ATTENDANCE_DISPUTE",
  OTHER = "OTHER",
}

// === Sync (동기화) ===

export enum SyncType {
  FAS_ATTENDANCE = "FAS_ATTENDANCE",
  FAS_WORKER = "FAS_WORKER",
  ATTENDANCE_MANUAL = "ATTENDANCE_MANUAL",
}

export enum SyncErrorStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  IGNORED = "IGNORED",
}
