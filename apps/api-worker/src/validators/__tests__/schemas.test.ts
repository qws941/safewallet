import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import * as schemas from "../schemas";

type Fixture = {
  valid: unknown;
  invalid: unknown;
};

const fixtures: Record<string, Fixture> = {
  RegisterSchema: {
    valid: {
      name: "Kim Worker",
      phone: "010-1234-5678",
      dob: "900101",
      deviceId: "device-1",
    },
    invalid: { name: "Kim Worker", phone: "010-12", dob: "900101" },
  },
  LoginSchema: {
    valid: { name: "Kim", phone: "01012345678", dob: "900101" },
    invalid: { name: "", phone: "01012345678", dob: "900101" },
  },
  AcetimeLoginSchema: {
    valid: { employeeCode: "25000002", name: "김선민" },
    invalid: { employeeCode: "", name: "김선민" },
  },
  RefreshTokenSchema: {
    valid: { refreshToken: "token-value" },
    invalid: { refreshToken: "" },
  },
  AdminLoginSchema: {
    valid: { username: "admin", password: "password" },
    invalid: { username: "admin", password: "" },
  },
  OtpRequestSchema: {
    valid: { phone: "01012345678" },
    invalid: { phone: "" },
  },
  CreatePostSchema: {
    valid: {
      siteId: "site-1",
      category: "HAZARD",
      content: "Unsafe cable placement",
      imageUrls: ["https://cdn.example/1.jpg"],
    },
    invalid: { siteId: "site-1", category: "INVALID", content: "x" },
  },
  ReviewActionSchema: {
    valid: { postId: "post-1", action: "APPROVE", comment: "ok" },
    invalid: { postId: "post-1", action: "UNKNOWN" },
  },
  CreateActionSchema: {
    valid: { postId: "post-1", assigneeType: "USER", priority: "HIGH" },
    invalid: { postId: "post-1", assigneeType: "", priority: "HIGH" },
  },
  UpdateActionStatusSchema: {
    valid: { actionStatus: "COMPLETED", completionNote: "done" },
    invalid: { actionStatus: "DONE" },
  },
  CreateSiteSchema: {
    valid: { name: "Site A", requiresApproval: true },
    invalid: { name: "" },
  },
  UpdateMemberStatusSchema: {
    valid: { status: "ACTIVE", reason: "approved" },
    invalid: { status: "UNKNOWN" },
  },
  UpdateSiteSchema: {
    valid: { name: "Updated", active: true, leaderboardEnabled: false },
    invalid: { active: "yes" },
  },
  AwardPointsSchema: {
    valid: {
      userId: "user-1",
      siteId: "site-1",
      amount: 10,
      reasonCode: "SAFE_BEHAVIOR",
    },
    invalid: {
      userId: "user-1",
      siteId: "site-1",
      amount: 1.2,
      reasonCode: "SAFE_BEHAVIOR",
    },
  },
  CreatePolicySchema: {
    valid: {
      siteId: "site-1",
      reasonCode: "SAFE_BEHAVIOR",
      name: "Safe",
      defaultAmount: 10,
    },
    invalid: {
      siteId: "site-1",
      reasonCode: "SAFE_BEHAVIOR",
      name: "Safe",
      defaultAmount: "10",
    },
  },
  UpdatePolicySchema: {
    valid: { name: "Policy", isActive: true },
    invalid: { defaultAmount: "10" },
  },
  CreateDisputeSchema: {
    valid: {
      siteId: "site-1",
      type: "POINT_DISPUTE",
      title: "Point mismatch",
      description: "Please review",
    },
    invalid: {
      siteId: "site-1",
      type: "UNKNOWN",
      title: "Point mismatch",
      description: "Please review",
    },
  },
  ResolveDisputeSchema: {
    valid: { status: "RESOLVED", resolutionNote: "Confirmed" },
    invalid: { status: "OPEN", resolutionNote: "Confirmed" },
  },
  UpdateDisputeStatusSchema: {
    valid: { status: "IN_REVIEW" },
    invalid: { status: "CLOSED" },
  },
  CreateAnnouncementSchema: {
    valid: {
      siteId: "site-1",
      title: "Notice",
      content: "Wear helmets",
      scheduledAt: "2026-02-15T00:00:00.000Z",
    },
    invalid: {
      siteId: "site-1",
      title: "Notice",
      content: "Wear",
      scheduledAt: "bad-date",
    },
  },
  UpdateAnnouncementSchema: {
    valid: { title: "Updated", isPinned: true, scheduledAt: null },
    invalid: { scheduledAt: "not-a-date" },
  },
  CastVoteSchema: {
    valid: { siteId: "site-1", candidateId: "user-2", month: "2026-02" },
    invalid: { siteId: "site-1", candidateId: "user-2", month: "2026/02" },
  },
  AdminChangeRoleSchema: {
    valid: { role: "SITE_ADMIN" },
    invalid: { role: "ADMIN" },
  },
  AdminSyncWorkersSchema: {
    valid: {
      siteId: "site-1",
      workers: [{ externalWorkerId: "ext-1", name: "Lee" }],
    },
    invalid: { siteId: "site-1", workers: [] },
  },
  AdminReviewPostSchema: {
    valid: { action: "APPROVE", pointsToAward: 10 },
    invalid: { action: "CLOSE" },
  },
  AdminManualApprovalSchema: {
    valid: { userId: "user-1", siteId: "site-1", reason: "Special case" },
    invalid: { userId: "user-1", siteId: "site-1", reason: "" },
  },
  AdminCreateVoteCandidateSchema: {
    valid: {
      userId: "user-1",
      siteId: "site-1",
      month: "2026-02",
      source: "ADMIN",
    },
    invalid: {
      userId: "user-1",
      siteId: "site-1",
      month: "2026-02",
      source: "SYSTEM",
    },
  },
  AdminCreateVotePeriodSchema: {
    valid: { startDate: "2026-02-01", endDate: "2026-02-28" },
    invalid: { startDate: "2026-02-01", endDate: 20260228 },
  },
  AdminResolveSyncErrorSchema: {
    valid: { status: "RESOLVED" },
    invalid: { status: "OPEN" },
  },
  AdminEmergencyDeleteSchema: {
    valid: { reason: "Duplicate and malicious post", confirmPostId: "post-1" },
    invalid: { reason: "too short", confirmPostId: "post-1" },
  },
  AdminEmergencyUserPurgeSchema: {
    valid: {
      reason: "Legal compliance PII purge request",
      confirmUserId: "user-1",
    },
    invalid: { reason: "short", confirmUserId: "user-1" },
  },
  AdminEmergencyActionPurgeSchema: {
    valid: {
      reason: "Compliance requirement action purge",
      confirmActionId: "action-1",
    },
    invalid: { reason: "short", confirmActionId: "action-1" },
  },
  CreateCourseSchema: {
    valid: {
      siteId: "site-1",
      title: "Fall prevention",
      contentType: "VIDEO",
      contentUrl: "https://cdn.example/video.mp4",
    },
    invalid: { siteId: "site-1", title: "Course", contentType: "AUDIO" },
  },
  UpdateCourseSchema: {
    valid: { title: "Updated", sortOrder: 1 },
    invalid: { sortOrder: 1.2 },
  },
  CreateQuizSchema: {
    valid: {
      siteId: "site-1",
      title: "Safety Quiz",
      questions: [
        {
          questionText: "What to wear?",
          options: ["Helmet", "Nothing"],
          correctIndex: 0,
        },
      ],
    },
    invalid: {
      siteId: "site-1",
      title: "Safety Quiz",
      questions: [
        {
          questionText: "What to wear?",
          options: ["Only one"],
          correctIndex: 0,
        },
      ],
    },
  },
  SubmitQuizSchema: {
    valid: {
      quizId: "quiz-1",
      siteId: "site-1",
      answers: [0, 1],
      startedAt: "2026-02-15T00:00:00.000Z",
    },
    invalid: {
      quizId: "quiz-1",
      siteId: "site-1",
      answers: [0.5],
      startedAt: "2026-02-15",
    },
  },
  CreateStatutoryTrainingSchema: {
    valid: {
      siteId: "site-1",
      userId: "user-1",
      trainingType: "NEW_WORKER",
      trainingName: "Orientation",
      trainingHours: 2,
      scheduledDate: "2026-02-20",
    },
    invalid: {
      siteId: "site-1",
      userId: "user-1",
      trainingType: "NEW_WORKER",
      trainingName: "Orientation",
      trainingHours: 0,
      scheduledDate: "2026-02-20",
    },
  },
  UpdateStatutoryTrainingSchema: {
    valid: { status: "COMPLETED", completedDate: "2026-02-21" },
    invalid: { status: "DONE" },
  },
  CreateTbmRecordSchema: {
    valid: {
      siteId: "site-1",
      tbmDate: "2026-02-15",
      topic: "Morning briefing",
      attendeeIds: ["user-1"],
    },
    invalid: {
      siteId: "site-1",
      tbmDate: "2026-02-15",
      topic: "Morning briefing",
      attendeeIds: [],
    },
  },
  UpdateTbmRecordSchema: {
    valid: { topic: "Updated topic" },
    invalid: { topic: "", location: "Gate A" },
  },
  AttendTbmSchema: {
    valid: { tbmRecordId: "tbm-1" },
    invalid: { tbmRecordId: "" },
  },
  ManualCheckinSchema: {
    valid: { siteId: "site-1", note: "manual override" },
    invalid: { siteId: "" },
  },
  UpdateProfileSchema: {
    valid: { name: "New Name" },
    invalid: { name: "" },
  },
  FasSyncRequestSchema: {
    valid: {
      siteId: "site-1",
      workers: [{ externalWorkerId: "e1", name: "Kim" }],
    },
    invalid: { siteId: "", workers: [] },
  },
  AlimtalkSendSchema: {
    valid: {
      siteId: "site-1",
      userIds: ["user-1"],
      templateCode: "TPL-001",
      message: "Safety notice",
    },
    invalid: {
      siteId: "site-1",
      userIds: [],
      templateCode: "TPL-001",
      message: "Safety notice",
    },
  },
  SmartNotificationSendSchema: {
    valid: {
      siteId: "site-1",
      userIds: ["user-1", "user-2"],
      templateCode: "SMART-001",
      message: "Reminder",
      smsTitle: "Alert",
    },
    invalid: {
      siteId: "site-1",
      userIds: ["user-1"],
      templateCode: "SMART-001",
      message: "Reminder",
      smsTitle: "x".repeat(41),
    },
  },
};

describe("schemas", () => {
  const exportedSchemas = Object.entries(schemas) as Array<
    [string, ZodTypeAny]
  >;

  it("has fixtures for every exported schema", () => {
    expect(new Set(Object.keys(fixtures))).toEqual(
      new Set(exportedSchemas.map(([name]) => name)),
    );
  });

  it.each(exportedSchemas)("accepts valid input for %s", (name, schema) => {
    const input = fixtures[name]?.valid;
    const result = schema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it.each(exportedSchemas)("rejects invalid input for %s", (name, schema) => {
    const input = fixtures[name]?.invalid;
    const result = schema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("normalizes register phone and dob fields", () => {
    const result = schemas.RegisterSchema.parse({
      name: "Kim Worker",
      phone: "010-1234-5678",
      dob: "1990-01-01",
    });

    expect(result.phone).toBe("01012345678");
    expect(result.dob).toBe("19900101");
  });

  it("returns expected validation errors for register and cast-vote", () => {
    const registerFail = schemas.RegisterSchema.safeParse({
      name: "Kim Worker",
      phone: "010",
      dob: "90",
    });
    const voteFail = schemas.CastVoteSchema.safeParse({
      siteId: "site-1",
      candidateId: "user-1",
      month: "2026/02",
    });

    if (registerFail.success) {
      throw new Error("Expected register validation to fail");
    }
    if (voteFail.success) {
      throw new Error("Expected cast vote validation to fail");
    }

    const messages = registerFail.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Phone number must be 11 digits");
    expect(messages).toContain("DOB must be 6 or 8 digits");
    expect(voteFail.error.issues[0]?.message).toBe("Must be YYYY-MM format");
  });
});
