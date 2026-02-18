import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../schema";

describe("db schema", () => {
  it("exports expected enum values", () => {
    expect(schema.userRoleEnum).toEqual([
      "WORKER",
      "SITE_ADMIN",
      "SUPER_ADMIN",
      "SYSTEM",
    ]);
    expect(schema.categoryEnum).toEqual([
      "HAZARD",
      "UNSAFE_BEHAVIOR",
      "INCONVENIENCE",
      "SUGGESTION",
      "BEST_PRACTICE",
    ]);
    expect(schema.riskLevelEnum).toEqual(["HIGH", "MEDIUM", "LOW"]);
    expect(schema.reviewStatusEnum).toEqual([
      "PENDING",
      "IN_REVIEW",
      "NEED_INFO",
      "APPROVED",
      "REJECTED",
      "URGENT",
    ]);
    expect(schema.syncErrorStatusEnum).toEqual(["OPEN", "RESOLVED", "IGNORED"]);
  });

  it("defines core table names and key columns", () => {
    expect(getTableName(schema.users)).toBe("users");
    expect(getTableName(schema.posts)).toBe("posts");
    expect(getTableName(schema.siteMemberships)).toBe("site_memberships");
    expect(getTableName(schema.apiMetrics)).toBe("api_metrics");

    const userColumns = getTableColumns(schema.users);
    expect(Object.keys(userColumns)).toEqual(
      expect.arrayContaining([
        "id",
        "phoneEncrypted",
        "phoneHash",
        "role",
        "createdAt",
      ]),
    );

    const postColumns = getTableColumns(schema.posts);
    expect(Object.keys(postColumns)).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "siteId",
        "category",
        "reviewStatus",
        "actionStatus",
      ]),
    );

    const policyColumns = getTableColumns(schema.accessPolicies);
    expect(Object.keys(policyColumns)).toEqual(
      expect.arrayContaining(["siteId", "requireCheckin", "dayCutoffHour"]),
    );
  });

  it("keeps enum-driven columns aligned with enum definitions", () => {
    const userColumns = getTableColumns(schema.users);
    const postColumns = getTableColumns(schema.posts);
    const disputeColumns = getTableColumns(schema.disputes);
    const trainingColumns = getTableColumns(schema.statutoryTrainings);

    expect(userColumns.role.enumValues).toEqual(schema.userRoleEnum);
    expect(postColumns.category.enumValues).toEqual(schema.categoryEnum);
    expect(postColumns.riskLevel.enumValues).toEqual(schema.riskLevelEnum);
    expect(postColumns.visibility.enumValues).toEqual(schema.visibilityEnum);
    expect(disputeColumns.status.enumValues).toEqual(schema.disputeStatusEnum);
    expect(trainingColumns.status.enumValues).toEqual(
      schema.trainingCompletionStatusEnum,
    );
  });

  it("exports relation definitions for major entities", () => {
    expect(schema.usersRelations).toBeDefined();
    expect(schema.sitesRelations).toBeDefined();
    expect(schema.postsRelations).toBeDefined();
    expect(schema.pointsLedgerRelations).toBeDefined();
    expect(schema.disputesRelations).toBeDefined();
    expect(schema.quizAttemptsRelations).toBeDefined();
    expect(schema.syncErrorsRelations).toBeDefined();
  });
});
