import { z } from "zod";

// ─── Shared Enum Values (must match Drizzle schema enums) ────────────────────

const UserRole = ["WORKER", "SITE_ADMIN", "SUPER_ADMIN", "SYSTEM"] as const;
const Category = [
  "HAZARD",
  "UNSAFE_BEHAVIOR",
  "INCONVENIENCE",
  "SUGGESTION",
  "BEST_PRACTICE",
] as const;
const RiskLevel = ["HIGH", "MEDIUM", "LOW"] as const;
const Visibility = ["WORKER_PUBLIC", "ADMIN_ONLY"] as const;
const ReviewAction = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
] as const;
const RejectReason = [
  "DUPLICATE",
  "UNCLEAR_PHOTO",
  "INSUFFICIENT",
  "FALSE",
  "IRRELEVANT",
  "OTHER",
] as const;
const TaskStatus = ["OPEN", "IN_PROGRESS", "DONE"] as const; // @deprecated
const ActionStatusUpdate = ["ASSIGNED", "IN_PROGRESS", "COMPLETED"] as const;
const ApprovalStatus = ["PENDING", "APPROVED", "REJECTED"] as const;
const MembershipStatus = ["PENDING", "ACTIVE", "LEFT", "REMOVED"] as const;
const EducationContentType = ["VIDEO", "IMAGE", "TEXT", "DOCUMENT"] as const;
const QuizStatus = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const StatutoryTrainingType = [
  "NEW_WORKER",
  "SPECIAL",
  "REGULAR",
  "CHANGE_OF_WORK",
] as const;
const TrainingCompletionStatus = ["SCHEDULED", "COMPLETED", "EXPIRED"] as const;

// Schema-only enums (not in packages/types)
const DisputeType = [
  "REVIEW_APPEAL",
  "POINT_DISPUTE",
  "ATTENDANCE_DISPUTE",
  "OTHER",
] as const;
const DisputeStatus = ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] as const;
const VoteCandidateSource = ["ADMIN", "AUTO"] as const;

// ─── Reusable Primitives ─────────────────────────────────────────────────────

const uuid = z.string().min(1).max(100);
const monthPattern = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format");
const isoDateStr = z.string().min(1);
const nonEmptyStr = z.string().min(1).max(5000);

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: nonEmptyStr,
  phone: z
    .string()
    .transform((val) => val.replace(/[^0-9]/g, ""))
    .refine((val) => val.length === 11, "Phone number must be 11 digits"),
  dob: z
    .string()
    .transform((val) => val.replace(/[^0-9]/g, ""))
    .refine(
      (val) => val.length === 6 || val.length === 8,
      "DOB must be 6 or 8 digits",
    ),
  deviceId: z.string().optional(),
});

export const LoginSchema = z.object({
  name: nonEmptyStr,
  phone: z.string().min(1),
  dob: z.string().min(1),
});

export const AcetimeLoginSchema = z.object({
  employeeCode: z
    .string()
    .min(1, "Employee code is required")
    .max(50, "Employee code too long")
    .transform((val) => val.trim()),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .transform((val) => val.trim()),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const AdminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// admin-create-otp reuses OtpRequestDto shape
export const OtpRequestSchema = z.object({
  phone: z.string().min(1),
});

// ─── Posts Schemas ───────────────────────────────────────────────────────────

export const CreatePostSchema = z.object({
  siteId: uuid,
  category: z.enum(Category),
  content: nonEmptyStr,
  hazardType: z.string().optional(),
  riskLevel: z.enum(RiskLevel).optional(),
  locationFloor: z.string().optional(),
  locationZone: z.string().optional(),
  locationDetail: z.string().optional(),
  visibility: z.enum(Visibility).optional(),
  isAnonymous: z.boolean().optional(),
  imageUrls: z.array(z.string()).optional(),
  imageHashes: z.array(z.string().nullable()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Reviews Schemas ─────────────────────────────────────────────────────────

export const ReviewActionSchema = z.object({
  postId: uuid,
  action: z.enum(ReviewAction),
  comment: z.string().optional(),
  reasonCode: z.enum(RejectReason).optional(),
});

// ─── Actions Schemas ─────────────────────────────────────────────────────────

export const CreateActionSchema = z.object({
  postId: uuid,
  assigneeType: z.string().min(1),
  assigneeId: uuid.optional(),
  dueDate: isoDateStr.optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  description: z.string().optional(),
});

export const UpdateActionStatusSchema = z.object({
  actionStatus: z.enum(ActionStatusUpdate),
  completionNote: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

// ─── Sites Schemas ───────────────────────────────────────────────────────────

export const CreateSiteSchema = z.object({
  name: nonEmptyStr,
  requiresApproval: z.boolean().optional(),
});

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(MembershipStatus),
  reason: z.string().optional(),
});

export const UpdateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
  leaderboardEnabled: z.boolean().optional(),
});

// ─── Points Schemas ──────────────────────────────────────────────────────────

export const AwardPointsSchema = z.object({
  userId: uuid,
  siteId: uuid,
  postId: uuid.optional(),
  amount: z.number().int(),
  reasonCode: z.string().min(1),
  reasonText: z.string().optional(),
});

// ─── Policies Schemas ────────────────────────────────────────────────────────

export const CreatePolicySchema = z.object({
  siteId: uuid,
  reasonCode: z.string().min(1),
  name: nonEmptyStr,
  description: z.string().optional(),
  defaultAmount: z.number(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  dailyLimit: z.number().optional(),
  monthlyLimit: z.number().optional(),
});

export const UpdatePolicySchema = z.object({
  name: nonEmptyStr.optional(),
  description: z.string().optional(),
  defaultAmount: z.number().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  dailyLimit: z.number().optional(),
  monthlyLimit: z.number().optional(),
  isActive: z.boolean().optional(),
});

// ─── Disputes Schemas ────────────────────────────────────────────────────────

export const CreateDisputeSchema = z.object({
  siteId: uuid,
  type: z.enum(DisputeType),
  title: nonEmptyStr,
  description: nonEmptyStr,
  refReviewId: uuid.optional(),
  refPointsLedgerId: uuid.optional(),
  refAttendanceId: uuid.optional(),
});

export const ResolveDisputeSchema = z.object({
  status: z.enum(["RESOLVED", "REJECTED"] as const),
  resolutionNote: nonEmptyStr,
});

export const UpdateDisputeStatusSchema = z.object({
  status: z.enum(DisputeStatus),
});

// ─── Announcements Schemas ───────────────────────────────────────────────────

export const CreateAnnouncementSchema = z.object({
  siteId: uuid,
  title: nonEmptyStr,
  content: nonEmptyStr,
  isPinned: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const UpdateAnnouncementSchema = z.object({
  title: nonEmptyStr.optional(),
  content: nonEmptyStr.optional(),
  isPinned: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

// ─── Votes Schemas ───────────────────────────────────────────────────────────

export const CastVoteSchema = z.object({
  siteId: uuid,
  candidateId: uuid,
  month: monthPattern,
});

// ─── Admin Schemas ───────────────────────────────────────────────────────────

export const AdminChangeRoleSchema = z.object({
  role: z.enum(UserRole),
});

export const AdminSyncWorkersSchema = z.object({
  siteId: uuid,
  workers: z
    .array(
      z.object({
        externalWorkerId: z.string().min(1),
        name: nonEmptyStr,
        nationality: z.string().optional(),
        trade: z.string().optional(),
        company: z.string().optional(),
      }),
    )
    .min(1),
});

export const AdminReviewPostSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_MORE"] as const),
  comment: z.string().optional(),
  reasonCode: z.string().optional(),
  pointsToAward: z.number().optional(),
});

export const AdminManualApprovalSchema = z.object({
  userId: uuid,
  siteId: uuid,
  reason: nonEmptyStr,
});

export const AdminCreateVoteCandidateSchema = z.object({
  userId: uuid,
  siteId: uuid,
  month: monthPattern,
  source: z.enum(VoteCandidateSource).optional(),
});

export const AdminCreateVotePeriodSchema = z.object({
  startDate: isoDateStr,
  endDate: isoDateStr,
});

export const AdminResolveSyncErrorSchema = z.object({
  status: z.enum(["RESOLVED", "IGNORED"] as const),
});

export const AdminEmergencyDeleteSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmPostId: z.string().min(1),
});

export const AdminEmergencyUserPurgeSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmUserId: z.string().min(1),
});

export const AdminEmergencyActionPurgeSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmActionId: z.string().min(1),
});

// ─── Education Schemas ───────────────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  siteId: uuid,
  title: nonEmptyStr,
  description: z.string().optional(),
  contentType: z.enum(EducationContentType),
  contentUrl: z.string().optional(),
  contentBody: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const UpdateCourseSchema = z.object({
  title: nonEmptyStr.optional(),
  description: z.string().optional(),
  contentType: z.enum(EducationContentType).optional(),
  contentUrl: z.string().optional(),
  contentBody: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const CreateQuizSchema = z.object({
  siteId: uuid,
  contentId: uuid.optional(),
  title: nonEmptyStr,
  description: z.string().optional(),
  passScore: z.number().int().optional(),
  pointsReward: z.number().int().optional(),
  timeLimitSec: z.number().int().optional(),
  questions: z
    .array(
      z.object({
        questionText: nonEmptyStr,
        options: z.array(z.string().min(1)).min(2),
        correctIndex: z.number().int().min(0),
        explanation: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .min(1),
});

export const SubmitQuizSchema = z.object({
  quizId: uuid,
  siteId: uuid,
  answers: z.array(z.number().int()),
  startedAt: isoDateStr,
});

export const CreateStatutoryTrainingSchema = z.object({
  siteId: uuid,
  userId: uuid,
  trainingType: z.enum(StatutoryTrainingType),
  trainingName: nonEmptyStr,
  trainingHours: z.number().positive(),
  scheduledDate: isoDateStr,
  expiryDate: isoDateStr.optional(),
  provider: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateStatutoryTrainingSchema = z.object({
  status: z.enum(TrainingCompletionStatus).optional(),
  completedDate: isoDateStr.optional(),
  certificateUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateTbmRecordSchema = z.object({
  siteId: uuid,
  tbmDate: isoDateStr,
  location: z.string().optional(),
  topic: nonEmptyStr,
  content: z.string().optional(),
  weatherInfo: z.string().optional(),
  safetyIssues: z.string().optional(),
  attendeeIds: z.array(uuid).min(1),
});

export const UpdateTbmRecordSchema = z.object({
  location: z.string().optional(),
  topic: nonEmptyStr.optional(),
  content: z.string().optional(),
  weatherInfo: z.string().optional(),
  safetyIssues: z.string().optional(),
});

export const AttendTbmSchema = z.object({
  tbmRecordId: uuid,
});

// ─── Attendance Schemas ──────────────────────────────────────────────────────

export const ManualCheckinSchema = z.object({
  siteId: uuid,
  userId: uuid.optional(),
  note: z.string().optional(),
});

// ─── Users Schemas ───────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

// ─── FAS Schemas ─────────────────────────────────────────────────────────────

export const FasSyncRequestSchema = z.object({
  siteId: uuid,
  workers: z
    .array(
      z.object({
        externalWorkerId: z.string().optional(),
        name: z.string().optional(),
        phone: z.string().optional(),
        dob: z.string().optional(),
        companyName: z.string().optional(),
        tradeType: z.string().optional(),
      }),
    )
    .optional(),
});

// ─── Alimtalk (알림톡) Schemas ────────────────────────────────────────────────

export const AlimtalkSendSchema = z.object({
  siteId: uuid,
  userIds: z.array(uuid).min(1).max(100),
  templateCode: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
  button: z
    .array(
      z.object({
        name: z.string().min(1).max(28),
        linkType: z.enum(["WL", "AL", "DS", "BK", "MD", "BC"]),
        linkTypeName: z.string().min(1),
      }),
    )
    .max(5)
    .optional(),
  fallbackSms: z.boolean().optional(),
});

export const SmartNotificationSendSchema = z.object({
  siteId: uuid,
  userIds: z.array(uuid).min(1).max(100),
  templateCode: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
  smsTitle: z.string().max(40).optional(),
  button: z
    .array(
      z.object({
        name: z.string().min(1).max(28),
        linkType: z.enum(["WL", "AL", "DS", "BK", "MD", "BC"]),
        linkTypeName: z.string().min(1),
      }),
    )
    .max(5)
    .optional(),
});
