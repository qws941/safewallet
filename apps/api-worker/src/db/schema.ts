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
    approvedById: text("approved_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    validDate: integer("valid_date", { mode: "timestamp" }).notNull(),
    approvedAt: integer("approved_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
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
  voteCandidates: many(voteCandidates),
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
