import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS - Aligned with Prisma schema.prisma
// ============================================================================

export const userRoleEnum = [
  "WORKER",
  "SITE_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM",
] as const;
export const membershipStatusEnum = [
  "PENDING",
  "ACTIVE",
  "LEFT",
  "REMOVED",
] as const;
export const membershipRoleEnum = ["WORKER", "SITE_ADMIN"] as const;
export const categoryEnum = [
  "HAZARD",
  "UNSAFE_BEHAVIOR",
  "INCONVENIENCE",
  "SUGGESTION",
  "BEST_PRACTICE",
] as const;
export const riskLevelEnum = ["HIGH", "MEDIUM", "LOW"] as const;
export const visibilityEnum = ["WORKER_PUBLIC", "ADMIN_ONLY"] as const;
export const reviewStatusEnum = [
  "RECEIVED",
  "IN_REVIEW",
  "NEED_INFO",
  "APPROVED",
  "REJECTED",
] as const;
export const actionStatusEnum = [
  "NONE",
  "REQUIRED",
  "ASSIGNED",
  "IN_PROGRESS",
  "DONE",
  "REOPENED",
] as const;
export const reviewActionEnum = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
] as const;
export const taskStatusEnum = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export const attendanceResultEnum = ["SUCCESS", "FAIL"] as const;
export const attendanceSourceEnum = ["FAS", "MANUAL"] as const;
export const voteCandidateSourceEnum = ["ADMIN", "AUTO"] as const;
export const disputeStatusEnum = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
] as const;
export const disputeTypeEnum = [
  "REVIEW_APPEAL",
  "POINT_DISPUTE",
  "ATTENDANCE_DISPUTE",
  "OTHER",
] as const;
export const approvalStatusEnum = ["PENDING", "APPROVED", "REJECTED"] as const;

// ============================================================================
// TABLES
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    phone: text("phone").unique().notNull(),
    phoneEncrypted: text("phone_encrypted"),
    phoneHash: text("phone_hash"),
    name: text("name"),
    nameMasked: text("name_masked"),
    dob: text("dob"),
    dobEncrypted: text("dob_encrypted"),
    dobHash: text("dob_hash"),
    externalSystem: text("external_system"),
    externalWorkerId: text("external_worker_id"),
    companyName: text("company_name"),
    tradeType: text("trade_type"),
    role: text("role", { enum: userRoleEnum }).default("WORKER").notNull(),
    piiViewFull: integer("pii_view_full", { mode: "boolean" })
      .default(false)
      .notNull(),
    canAwardPoints: integer("can_award_points", { mode: "boolean" })
      .default(false)
      .notNull(),
    canManageUsers: integer("can_manage_users", { mode: "boolean" })
      .default(false)
      .notNull(),
    falseReportCount: integer("false_report_count").default(0).notNull(),
    restrictedUntil: integer("restricted_until", { mode: "timestamp" }),
    otpCode: text("otp_code"),
    otpExpiresAt: integer("otp_expires_at", { mode: "timestamp" }),
    otpAttemptCount: integer("otp_attempt_count").default(0).notNull(),
    refreshToken: text("refresh_token"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    phoneHashDobHashIdx: index("users_phone_hash_dob_hash_idx").on(
      table.phoneHash,
      table.dobHash,
    ),
    externalIdx: index("users_external_idx").on(
      table.externalSystem,
      table.externalWorkerId,
    ),
  }),
);

export const sites = sqliteTable("sites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  joinCode: text("join_code").unique().notNull(),
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  joinEnabled: integer("join_enabled", { mode: "boolean" })
    .default(true)
    .notNull(),
  requiresApproval: integer("requires_approval", { mode: "boolean" })
    .default(false)
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  closedAt: integer("closed_at", { mode: "timestamp" }),
});

export const siteMemberships = sqliteTable(
  "site_memberships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    role: text("role", { enum: membershipRoleEnum })
      .default("WORKER")
      .notNull(),
    status: text("status", { enum: membershipStatusEnum })
      .default("PENDING")
      .notNull(),
    joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    leftAt: integer("left_at", { mode: "timestamp" }),
    leftReason: text("left_reason"),
  },
  (table) => ({
    userSiteUnique: unique().on(table.userId, table.siteId),
    siteStatusIdx: index("site_memberships_site_status_idx").on(
      table.siteId,
      table.status,
    ),
  }),
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    category: text("category", { enum: categoryEnum }).notNull(),
    hazardType: text("hazard_type"),
    riskLevel: text("risk_level", { enum: riskLevelEnum }),
    locationFloor: text("location_floor"),
    locationZone: text("location_zone"),
    locationDetail: text("location_detail"),
    content: text("content").notNull(),
    metadata: text("metadata", { mode: "json" }),
    visibility: text("visibility", { enum: visibilityEnum })
      .default("WORKER_PUBLIC")
      .notNull(),
    isAnonymous: integer("is_anonymous", { mode: "boolean" })
      .default(false)
      .notNull(),
    isPotentialDuplicate: integer("is_potential_duplicate", { mode: "boolean" })
      .default(false)
      .notNull(),
    duplicateOfPostId: text("duplicate_of_post_id"),
    reviewStatus: text("review_status", { enum: reviewStatusEnum })
      .default("RECEIVED")
      .notNull(),
    actionStatus: text("action_status", { enum: actionStatusEnum })
      .default("NONE")
      .notNull(),
    isUrgent: integer("is_urgent", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteReviewStatusIdx: index("posts_site_review_status_idx").on(
      table.siteId,
      table.reviewStatus,
    ),
    siteCreatedAtIdx: index("posts_site_created_at_idx").on(
      table.siteId,
      table.createdAt,
    ),
    userCreatedAtIdx: index("posts_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const postImages = sqliteTable("post_images", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action", { enum: reviewActionEnum }).notNull(),
    comment: text("comment"),
    reasonCode: text("reason_code"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    postCreatedAtIdx: index("reviews_post_created_at_idx").on(
      table.postId,
      table.createdAt,
    ),
  }),
);

export const pointsLedger = sqliteTable(
  "points_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    postId: text("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    refLedgerId: text("ref_ledger_id"),
    amount: integer("amount").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    adminId: text("admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    settleMonth: text("settle_month").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    userSiteMonthIdx: index("points_ledger_user_site_month_idx").on(
      table.userId,
      table.siteId,
      table.settleMonth,
    ),
    siteMonthIdx: index("points_ledger_site_month_idx").on(
      table.siteId,
      table.settleMonth,
    ),
  }),
);

export const actions = sqliteTable(
  "actions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    assigneeType: text("assignee_type").notNull(),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: integer("due_date", { mode: "timestamp" }),
    actionStatus: text("action_status", { enum: taskStatusEnum })
      .default("OPEN")
      .notNull(),
    completionNote: text("completion_note"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    postIdx: index("actions_post_idx").on(table.postId),
  }),
);

export const actionImages = sqliteTable("action_images", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  actionId: text("action_id")
    .notNull()
    .references(() => actions.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    actorCreatedAtIdx: index("audit_logs_actor_created_at_idx").on(
      table.actorId,
      table.createdAt,
    ),
    targetIdx: index("audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
    ),
  }),
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    isPinned: integer("is_pinned", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    sitePinnedCreatedAtIdx: index(
      "announcements_site_pinned_created_at_idx",
    ).on(table.siteId, table.isPinned, table.createdAt),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshToken: text("refresh_token").unique().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    userIdx: index("sessions_user_idx").on(table.userId),
  }),
);

export const attendance = sqliteTable(
  "attendances",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    externalWorkerId: text("external_worker_id"),
    checkinAt: integer("checkin_at", { mode: "timestamp" }).notNull(),
    result: text("result", { enum: attendanceResultEnum }).notNull(),
    deviceId: text("device_id"),
    source: text("source", { enum: attendanceSourceEnum }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteCheckinIdx: index("attendance_site_checkin_idx").on(
      table.siteId,
      table.checkinAt,
    ),
    userCheckinIdx: index("attendance_user_checkin_idx").on(
      table.userId,
      table.checkinAt,
    ),
    externalCheckinIdx: index("attendance_external_checkin_idx").on(
      table.externalWorkerId,
      table.checkinAt,
    ),
    externalSiteCheckinUnique: unique(
      "attendance_external_site_checkin_unique",
    ).on(table.externalWorkerId, table.siteId, table.checkinAt),
  }),
);

export const accessPolicies = sqliteTable("access_policies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  siteId: text("site_id")
    .unique()
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  requireCheckin: integer("require_checkin", { mode: "boolean" })
    .default(true)
    .notNull(),
  dayCutoffHour: integer("day_cutoff_hour").default(5).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const manualApprovals = sqliteTable(
  "manual_approvals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    reason: text("reason").notNull(),
    validDate: integer("valid_date", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: approvalStatusEnum })
      .default("PENDING")
      .notNull(),
    rejectionReason: text("rejection_reason"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    userValidDateIdx: index("manual_approvals_user_valid_date_idx").on(
      table.userId,
      table.validDate,
    ),
    siteValidDateIdx: index("manual_approvals_site_valid_date_idx").on(
      table.siteId,
      table.validDate,
    ),
  }),
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    votedAt: integer("voted_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteMonthVoterUnique: unique().on(table.siteId, table.month, table.voterId),
    siteMonthIdx: index("votes_site_month_idx").on(table.siteId, table.month),
  }),
);

export const voteCandidates = sqliteTable(
  "vote_candidates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source", { enum: voteCandidateSourceEnum }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteMonthUserUnique: unique().on(table.siteId, table.month, table.userId),
    siteMonthIdx: index("vote_candidates_site_month_idx").on(
      table.siteId,
      table.month,
    ),
  }),
);

export const votePeriods = sqliteTable(
  "vote_periods",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteMonthUnique: unique().on(table.siteId, table.month),
  }),
);

export const disputes = sqliteTable(
  "disputes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: disputeTypeEnum }).notNull(),
    status: text("status", { enum: disputeStatusEnum })
      .default("OPEN")
      .notNull(),
    refReviewId: text("ref_review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),
    refPointsLedgerId: text("ref_points_ledger_id").references(
      () => pointsLedger.id,
      { onDelete: "set null" },
    ),
    refAttendanceId: text("ref_attendance_id").references(() => attendance.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    resolvedById: text("resolved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("disputes_site_idx").on(table.siteId),
    userIdx: index("disputes_user_idx").on(table.userId),
    statusIdx: index("disputes_status_idx").on(table.status),
  }),
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(siteMemberships),
  posts: many(posts),
  reviews: many(reviews),
  pointsGiven: many(pointsLedger, { relationName: "pointsAdmin" }),
  pointsReceived: many(pointsLedger, { relationName: "pointsUser" }),
  auditLogs: many(auditLogs),
  announcements: many(announcements),
  sessions: many(sessions),
  actions: many(actions),
  attendances: many(attendance),
  votesGiven: many(votes, { relationName: "voteVoter" }),
  votesReceived: many(votes, { relationName: "voteCandidate" }),
  votesCandidacy: many(voteCandidates),
  approvalsGiven: many(manualApprovals, { relationName: "approvalAdmin" }),
  approvalsReceived: many(manualApprovals, { relationName: "approvalUser" }),
  disputesFiled: many(disputes, { relationName: "disputeUser" }),
  disputesResolved: many(disputes, { relationName: "disputeResolver" }),
  quizAttempts: many(quizAttempts),
  statutoryTrainings: many(statutoryTrainings, {
    relationName: "trainingUser",
  }),
  statutoryTrainingsCreated: many(statutoryTrainings, {
    relationName: "trainingCreator",
  }),
  tbmRecordsLed: many(tbmRecords),
  tbmAttendances: many(tbmAttendees),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  memberships: many(siteMemberships),
  posts: many(posts),
  pointsLedger: many(pointsLedger),
  announcements: many(announcements),
  attendances: many(attendance),
  accessPolicy: one(accessPolicies),
  manualApprovals: many(manualApprovals),
  votes: many(votes),
  disputes: many(disputes),
  voteCandidates: many(voteCandidates),
  educationContents: many(educationContents),
  quizzes: many(quizzes),
  quizAttempts: many(quizAttempts),
  statutoryTrainings: many(statutoryTrainings),
  tbmRecords: many(tbmRecords),
}));

export const siteMembershipsRelations = relations(
  siteMemberships,
  ({ one }) => ({
    user: one(users, {
      fields: [siteMemberships.userId],
      references: [users.id],
    }),
    site: one(sites, {
      fields: [siteMemberships.siteId],
      references: [sites.id],
    }),
  }),
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  site: one(sites, { fields: [posts.siteId], references: [sites.id] }),
  images: many(postImages),
  reviews: many(reviews),
  pointsLedger: many(pointsLedger),
  actions: many(actions),
}));

export const postImagesRelations = relations(postImages, ({ one }) => ({
  post: one(posts, { fields: [postImages.postId], references: [posts.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  post: one(posts, { fields: [reviews.postId], references: [posts.id] }),
  admin: one(users, { fields: [reviews.adminId], references: [users.id] }),
}));

export const pointsLedgerRelations = relations(
  pointsLedger,
  ({ one, many }) => ({
    user: one(users, {
      fields: [pointsLedger.userId],
      references: [users.id],
      relationName: "pointsUser",
    }),
    site: one(sites, { fields: [pointsLedger.siteId], references: [sites.id] }),
    post: one(posts, { fields: [pointsLedger.postId], references: [posts.id] }),
    admin: one(users, {
      fields: [pointsLedger.adminId],
      references: [users.id],
      relationName: "pointsAdmin",
    }),
    refLedger: one(pointsLedger, {
      fields: [pointsLedger.refLedgerId],
      references: [pointsLedger.id],
      relationName: "pointsAdjustment",
    }),
    adjustments: many(pointsLedger, { relationName: "pointsAdjustment" }),
  }),
);

export const actionsRelations = relations(actions, ({ one, many }) => ({
  post: one(posts, { fields: [actions.postId], references: [posts.id] }),
  assignee: one(users, {
    fields: [actions.assigneeId],
    references: [users.id],
  }),
  images: many(actionImages),
}));

export const actionImagesRelations = relations(actionImages, ({ one }) => ({
  action: one(actions, {
    fields: [actionImages.actionId],
    references: [actions.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  site: one(sites, { fields: [announcements.siteId], references: [sites.id] }),
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  site: one(sites, { fields: [attendance.siteId], references: [sites.id] }),
  user: one(users, { fields: [attendance.userId], references: [users.id] }),
}));

export const accessPoliciesRelations = relations(accessPolicies, ({ one }) => ({
  site: one(sites, { fields: [accessPolicies.siteId], references: [sites.id] }),
}));

export const manualApprovalsRelations = relations(
  manualApprovals,
  ({ one }) => ({
    user: one(users, {
      fields: [manualApprovals.userId],
      references: [users.id],
      relationName: "approvalUser",
    }),
    approvedBy: one(users, {
      fields: [manualApprovals.approvedById],
      references: [users.id],
      relationName: "approvalAdmin",
    }),
    site: one(sites, {
      fields: [manualApprovals.siteId],
      references: [sites.id],
    }),
  }),
);

export const votesRelations = relations(votes, ({ one }) => ({
  site: one(sites, { fields: [votes.siteId], references: [sites.id] }),
  voter: one(users, {
    fields: [votes.voterId],
    references: [users.id],
    relationName: "voteVoter",
  }),
  candidate: one(users, {
    fields: [votes.candidateId],
    references: [users.id],
    relationName: "voteCandidate",
  }),
}));

export const voteCandidatesRelations = relations(voteCandidates, ({ one }) => ({
  site: one(sites, { fields: [voteCandidates.siteId], references: [sites.id] }),
  user: one(users, { fields: [voteCandidates.userId], references: [users.id] }),
}));

export const votePeriodsRelations = relations(votePeriods, ({ one }) => ({
  site: one(sites, { fields: [votePeriods.siteId], references: [sites.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  site: one(sites, { fields: [disputes.siteId], references: [sites.id] }),
  user: one(users, {
    fields: [disputes.userId],
    references: [users.id],
    relationName: "disputeUser",
  }),
  resolvedBy: one(users, {
    fields: [disputes.resolvedById],
    references: [users.id],
    relationName: "disputeResolver",
  }),
  refReview: one(reviews, {
    fields: [disputes.refReviewId],
    references: [reviews.id],
  }),
  refPointsLedger: one(pointsLedger, {
    fields: [disputes.refPointsLedgerId],
    references: [pointsLedger.id],
  }),
  refAttendance: one(attendance, {
    fields: [disputes.refAttendanceId],
    references: [attendance.id],
  }),
}));

// ============================================================================
// NEW TABLES FOR REMAINING REQUIREMENTS
// ============================================================================

// QR Code History - Track previous join codes for invalidation
export const joinCodeHistory = sqliteTable(
  "join_code_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    joinCode: text("join_code").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invalidatedAt: integer("invalidated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("join_code_history_site_idx").on(table.siteId),
    codeIdx: index("join_code_history_code_idx").on(table.joinCode),
  }),
);

// Device Registrations - Track device IDs for fraud prevention
export const deviceRegistrations = sqliteTable(
  "device_registrations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    deviceInfo: text("device_info"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    isTrusted: integer("is_trusted", { mode: "boolean" })
      .default(true)
      .notNull(),
    isBanned: integer("is_banned", { mode: "boolean" })
      .default(false)
      .notNull(),
  },
  (table) => ({
    userDeviceUnique: unique().on(table.userId, table.deviceId),
    deviceIdx: index("device_registrations_device_idx").on(table.deviceId),
    userIdx: index("device_registrations_user_idx").on(table.userId),
  }),
);

// Point Policies - Configurable point rules per site
export const pointPolicies = sqliteTable(
  "point_policies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    reasonCode: text("reason_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    defaultAmount: integer("default_amount").notNull(),
    minAmount: integer("min_amount"),
    maxAmount: integer("max_amount"),
    dailyLimit: integer("daily_limit"),
    monthlyLimit: integer("monthly_limit"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteReasonUnique: unique().on(table.siteId, table.reasonCode),
    siteIdx: index("point_policies_site_idx").on(table.siteId),
  }),
);

// Push Subscriptions - Web Push notification subscriptions
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdx: index("push_subscriptions_user_idx").on(table.userId),
    endpointUnique: unique().on(table.endpoint),
  }),
);

// ============================================================================
// NEW RELATIONS
// ============================================================================

export const joinCodeHistoryRelations = relations(
  joinCodeHistory,
  ({ one }) => ({
    site: one(sites, {
      fields: [joinCodeHistory.siteId],
      references: [sites.id],
    }),
    createdBy: one(users, {
      fields: [joinCodeHistory.createdById],
      references: [users.id],
    }),
  }),
);

export const deviceRegistrationsRelations = relations(
  deviceRegistrations,
  ({ one }) => ({
    user: one(users, {
      fields: [deviceRegistrations.userId],
      references: [users.id],
    }),
  }),
);

export const pointPoliciesRelations = relations(pointPolicies, ({ one }) => ({
  site: one(sites, { fields: [pointPolicies.siteId], references: [sites.id] }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

// ============================================================================
// SAFETY EDUCATION (안전교육)
// ============================================================================

export const educationContentTypeEnum = [
  "VIDEO",
  "IMAGE",
  "TEXT",
  "DOCUMENT",
] as const;
export const quizStatusEnum = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const statutoryTrainingTypeEnum = [
  "NEW_WORKER",
  "SPECIAL",
  "REGULAR",
  "CHANGE_OF_WORK",
] as const;
export const trainingCompletionStatusEnum = [
  "SCHEDULED",
  "COMPLETED",
  "EXPIRED",
] as const;

// Education Content - 교육 콘텐츠 (비디오/이미지/텍스트/문서)
export const educationContents = sqliteTable(
  "education_contents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    contentType: text("content_type", {
      enum: educationContentTypeEnum,
    }).notNull(),
    contentUrl: text("content_url"),
    thumbnailUrl: text("thumbnail_url"),
    durationMinutes: integer("duration_minutes"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("education_contents_site_idx").on(table.siteId),
    siteActiveIdx: index("education_contents_site_active_idx").on(
      table.siteId,
      table.isActive,
    ),
  }),
);

// Quizzes - 퀴즈 (콘텐츠와 연결 가능)
export const quizzes = sqliteTable(
  "quizzes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    contentId: text("content_id").references(() => educationContents.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: quizStatusEnum }).default("DRAFT").notNull(),
    pointsReward: integer("points_reward").default(0).notNull(),
    passingScore: integer("passing_score").default(70).notNull(),
    timeLimitMinutes: integer("time_limit_minutes"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("quizzes_site_idx").on(table.siteId),
    siteStatusIdx: index("quizzes_site_status_idx").on(
      table.siteId,
      table.status,
    ),
    contentIdx: index("quizzes_content_idx").on(table.contentId),
  }),
);

// Quiz Questions - 퀴즈 문항
export const quizQuestions = sqliteTable(
  "quiz_questions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: text("options", { mode: "json" }).notNull().$type<string[]>(),
    correctAnswer: integer("correct_answer").notNull(),
    explanation: text("explanation"),
    orderIndex: integer("order_index").default(0).notNull(),
  },
  (table) => ({
    quizIdx: index("quiz_questions_quiz_idx").on(table.quizId),
    quizOrderIdx: index("quiz_questions_quiz_order_idx").on(
      table.quizId,
      table.orderIndex,
    ),
  }),
);

// Quiz Attempts - 퀴즈 응시 기록
export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    answers: text("answers", { mode: "json" }).$type<number[]>(),
    score: integer("score").default(0).notNull(),
    passed: integer("passed", { mode: "boolean" }).default(false).notNull(),
    pointsAwarded: integer("points_awarded").default(0).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => ({
    quizUserIdx: index("quiz_attempts_quiz_user_idx").on(
      table.quizId,
      table.userId,
    ),
    siteIdx: index("quiz_attempts_site_idx").on(table.siteId),
    userIdx: index("quiz_attempts_user_idx").on(table.userId),
  }),
);

// Statutory Trainings - 법정 안전교육 이수 기록
export const statutoryTrainings = sqliteTable(
  "statutory_trainings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trainingType: text("training_type", {
      enum: statutoryTrainingTypeEnum,
    }).notNull(),
    trainingName: text("training_name").notNull(),
    trainingDate: text("training_date").notNull(),
    expirationDate: text("expiration_date"),
    provider: text("provider"),
    certificateUrl: text("certificate_url"),
    hoursCompleted: integer("hours_completed").default(0).notNull(),
    status: text("status", { enum: trainingCompletionStatusEnum })
      .default("SCHEDULED")
      .notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteUserIdx: index("statutory_trainings_site_user_idx").on(
      table.siteId,
      table.userId,
    ),
    siteTypeIdx: index("statutory_trainings_site_type_idx").on(
      table.siteId,
      table.trainingType,
    ),
    userIdx: index("statutory_trainings_user_idx").on(table.userId),
    statusIdx: index("statutory_trainings_status_idx").on(table.status),
    expirationIdx: index("statutory_trainings_expiration_idx").on(
      table.expirationDate,
    ),
  }),
);

// TBM Records - TBM(Toolbox Meeting) 교육 기록
export const tbmRecords = sqliteTable(
  "tbm_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    topic: text("topic").notNull(),
    content: text("content"),
    leaderId: text("leader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weatherCondition: text("weather_condition"),
    specialNotes: text("special_notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteDateIdx: index("tbm_records_site_date_idx").on(
      table.siteId,
      table.date,
    ),
    siteIdx: index("tbm_records_site_idx").on(table.siteId),
    leaderIdx: index("tbm_records_leader_idx").on(table.leaderId),
  }),
);

// TBM Attendees - TBM 참석자 기록
export const tbmAttendees = sqliteTable(
  "tbm_attendees",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tbmRecordId: text("tbm_record_id")
      .notNull()
      .references(() => tbmRecords.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attendedAt: integer("attended_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    tbmUserUnique: unique().on(table.tbmRecordId, table.userId),
    tbmRecordIdx: index("tbm_attendees_tbm_record_idx").on(table.tbmRecordId),
    userIdx: index("tbm_attendees_user_idx").on(table.userId),
  }),
);

// ============================================================================
// SAFETY EDUCATION RELATIONS
// ============================================================================

export const educationContentsRelations = relations(
  educationContents,
  ({ one, many }) => ({
    site: one(sites, {
      fields: [educationContents.siteId],
      references: [sites.id],
    }),
    createdBy: one(users, {
      fields: [educationContents.createdById],
      references: [users.id],
    }),
    quizzes: many(quizzes),
  }),
);

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  site: one(sites, { fields: [quizzes.siteId], references: [sites.id] }),
  content: one(educationContents, {
    fields: [quizzes.contentId],
    references: [educationContents.id],
  }),
  createdBy: one(users, {
    fields: [quizzes.createdById],
    references: [users.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [quizAttempts.siteId],
    references: [sites.id],
  }),
}));

export const statutoryTrainingsRelations = relations(
  statutoryTrainings,
  ({ one }) => ({
    site: one(sites, {
      fields: [statutoryTrainings.siteId],
      references: [sites.id],
    }),
    user: one(users, {
      fields: [statutoryTrainings.userId],
      references: [users.id],
      relationName: "trainingUser",
    }),
    createdBy: one(users, {
      fields: [statutoryTrainings.createdById],
      references: [users.id],
      relationName: "trainingCreator",
    }),
  }),
);

export const tbmRecordsRelations = relations(tbmRecords, ({ one, many }) => ({
  site: one(sites, {
    fields: [tbmRecords.siteId],
    references: [sites.id],
  }),
  leader: one(users, {
    fields: [tbmRecords.leaderId],
    references: [users.id],
  }),
  attendees: many(tbmAttendees),
}));

export const tbmAttendeesRelations = relations(tbmAttendees, ({ one }) => ({
  tbmRecord: one(tbmRecords, {
    fields: [tbmAttendees.tbmRecordId],
    references: [tbmRecords.id],
  }),
  user: one(users, {
    fields: [tbmAttendees.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// SYNC ERRORS - Track FAS sync failures for retry & visibility
// ============================================================================

export const syncTypeEnum = [
  "FAS_ATTENDANCE",
  "FAS_WORKER",
  "ATTENDANCE_MANUAL",
] as const;
export const syncErrorStatusEnum = ["OPEN", "RESOLVED", "IGNORED"] as const;

export const syncErrors = sqliteTable(
  "sync_errors",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").references(() => sites.id),
    syncType: text("sync_type", { enum: syncTypeEnum }).notNull(),
    status: text("status", { enum: syncErrorStatusEnum })
      .notNull()
      .default("OPEN"),
    errorCode: text("error_code"),
    errorMessage: text("error_message").notNull(),
    payload: text("payload"), // JSON string of failed data
    retryCount: integer("retry_count").notNull().default(0),
    lastRetryAt: text("last_retry_at"),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    siteTypeIdx: index("sync_errors_site_type_idx").on(
      table.siteId,
      table.syncType,
    ),
    statusIdx: index("sync_errors_status_idx").on(table.status),
    createdAtIdx: index("sync_errors_created_at_idx").on(table.createdAt),
  }),
);

export const syncErrorsRelations = relations(syncErrors, ({ one }) => ({
  site: one(sites, {
    fields: [syncErrors.siteId],
    references: [sites.id],
  }),
}));
