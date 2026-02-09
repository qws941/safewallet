import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import {
  voteCandidates,
  votes,
  votePeriods,
  users,
  auditLogs,
} from "../../db/schema";
import {
  AdminCreateVoteCandidateSchema,
  AdminCreateVotePeriodSchema,
} from "../../validators/schemas";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { requireAdmin, buildCsv, csvResponse } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/votes/candidates", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const month = c.req.query("month"); // YYYY-MM

  if (!siteId || !month) {
    return error(c, "MISSING_PARAMS", "siteId and month are required", 400);
  }

  const candidates = await db
    .select({
      id: voteCandidates.id,
      month: voteCandidates.month,
      source: voteCandidates.source,
      createdAt: voteCandidates.createdAt,
      user: {
        id: users.id,
        name: users.name,
        nameMasked: users.nameMasked,
        companyName: users.companyName,
        tradeType: users.tradeType,
      },
    })
    .from(voteCandidates)
    .innerJoin(users, eq(voteCandidates.userId, users.id))
    .where(
      and(eq(voteCandidates.siteId, siteId), eq(voteCandidates.month, month)),
    )
    .orderBy(desc(voteCandidates.createdAt))
    .all();

  return success(c, { candidates });
});

app.post(
  "/votes/candidates",
  requireAdmin,
  zValidator("json", AdminCreateVoteCandidateSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");

    const body: z.infer<typeof AdminCreateVoteCandidateSchema> =
      c.req.valid("json");

    if (!body.userId || !body.siteId || !body.month) {
      return error(
        c,
        "MISSING_FIELDS",
        "userId, siteId, and month are required",
        400,
      );
    }

    // Check duplicate
    const existing = await db
      .select()
      .from(voteCandidates)
      .where(
        and(
          eq(voteCandidates.siteId, body.siteId),
          eq(voteCandidates.userId, body.userId),
          eq(voteCandidates.month, body.month),
        ),
      )
      .get();

    if (existing) {
      return error(
        c,
        "DUPLICATE_CANDIDATE",
        "Candidate already exists for this month",
        409,
      );
    }

    const newCandidate = await db
      .insert(voteCandidates)
      .values({
        userId: body.userId,
        siteId: body.siteId,
        month: body.month,
        source: "ADMIN",
      })
      .returning()
      .get();

    await db.insert(auditLogs).values({
      action: "VOTE_CANDIDATE_ADDED",
      actorId: currentUser.id,
      targetType: "VOTE_CANDIDATE",
      targetId: newCandidate.id,
      reason: `Added candidate ${body.userId} for ${body.month}`,
    });

    return success(c, { candidate: newCandidate }, 201);
  },
);

app.get("/votes/results", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const siteId = c.req.query("siteId");
  const month = c.req.query("month");
  const format = c.req.query("format") || "json";

  if (!siteId || !month) {
    return error(c, "MISSING_PARAMS", "siteId and month are required", 400);
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
  }

  if (format !== "json" && format !== "csv") {
    return error(
      c,
      "UNSUPPORTED_FORMAT",
      "Only json or csv format supported",
      400,
    );
  }

  const voteCountExpression = sql<number>`COALESCE(COUNT(${votes.id}), 0)`;
  const candidateRows = await db
    .select({
      candidateId: voteCandidates.id,
      candidateName: users.nameMasked,
      voteCount: voteCountExpression.as("voteCount"),
    })
    .from(voteCandidates)
    .innerJoin(users, eq(voteCandidates.userId, users.id))
    .leftJoin(
      votes,
      and(
        eq(votes.siteId, voteCandidates.siteId),
        eq(votes.month, voteCandidates.month),
        eq(votes.candidateId, voteCandidates.userId),
      ),
    )
    .where(
      and(eq(voteCandidates.siteId, siteId), eq(voteCandidates.month, month)),
    )
    .groupBy(voteCandidates.id, users.nameMasked)
    .orderBy(desc(voteCountExpression), users.nameMasked)
    .all();

  const results = candidateRows.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    candidateName: candidate.candidateName || "",
    voteCount: candidate.voteCount,
    rank: index + 1,
  }));

  if (format === "csv") {
    await logAuditWithContext(
      c,
      db,
      "VOTE_RESULT_EXPORT",
      currentUser.id,
      "EXPORT",
      siteId,
      {
        exportType: "vote-results",
        filterConditions: { siteId, month },
        rowCount: results.length,
      },
    );

    const headers = ["후보 ID", "후보자명", "득표수", "순위"];
    const rows = results.map((result) => [
      result.candidateId,
      result.candidateName,
      result.voteCount,
      result.rank,
    ]);
    const csv = buildCsv(headers, rows);
    return csvResponse(c, csv, `vote-results-${siteId}-${month}.csv`);
  }

  return success(c, results);
});

app.delete("/votes/candidates/:id", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(voteCandidates)
    .where(eq(voteCandidates.id, id))
    .get();

  if (!existing) {
    return error(c, "CANDIDATE_NOT_FOUND", "Candidate not found", 404);
  }

  await db.delete(voteCandidates).where(eq(voteCandidates.id, id)).run();

  await db.insert(auditLogs).values({
    action: "VOTE_CANDIDATE_REMOVED",
    actorId: currentUser.id,
    targetType: "VOTE_CANDIDATE",
    targetId: id,
    reason: `Removed candidate ${existing.userId} from ${existing.month}`,
  });

  return success(c, { success: true });
});

app.get("/votes/period/:siteId/:month", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.param("siteId");
  const month = c.req.param("month");

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
  }

  const period = await db
    .select()
    .from(votePeriods)
    .where(and(eq(votePeriods.siteId, siteId), eq(votePeriods.month, month)))
    .get();

  return success(c, { period: period || null });
});

app.put(
  "/votes/period/:siteId/:month",
  requireAdmin,
  zValidator("json", AdminCreateVotePeriodSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const siteId = c.req.param("siteId");
    const month = c.req.param("month");

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
    }

    const body: z.infer<typeof AdminCreateVotePeriodSchema> =
      c.req.valid("json");

    if (!body.startDate || !body.endDate) {
      return error(
        c,
        "MISSING_FIELDS",
        "startDate and endDate are required",
        400,
      );
    }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return error(c, "INVALID_DATE", "Invalid date format", 400);
    }
    if (start >= end) {
      return error(c, "INVALID_RANGE", "startDate must be before endDate", 400);
    }

    const existing = await db
      .select()
      .from(votePeriods)
      .where(and(eq(votePeriods.siteId, siteId), eq(votePeriods.month, month)))
      .get();

    let period: typeof votePeriods.$inferSelect | undefined;
    if (existing) {
      period = await db
        .update(votePeriods)
        .set({
          startDate: Math.floor(new Date(body.startDate).getTime() / 1000),
          endDate: Math.floor(new Date(body.endDate).getTime() / 1000),
        })
        .where(eq(votePeriods.id, existing.id))
        .returning()
        .get();
    } else {
      period = await db
        .insert(votePeriods)
        .values({
          siteId,
          month,
          startDate: Math.floor(new Date(body.startDate).getTime() / 1000),
          endDate: Math.floor(new Date(body.endDate).getTime() / 1000),
        })
        .returning()
        .get();
    }

    if (!period) {
      return error(
        c,
        "VOTE_PERIOD_UPDATE_FAILED",
        "Failed to update vote period",
        500,
      );
    }

    await db.insert(auditLogs).values({
      action: "VOTE_PERIOD_UPDATED",
      actorId: currentUser.id,
      targetType: "VOTE_PERIOD",
      targetId: period.id,
      reason: `Set vote period for ${month}: ${body.startDate} ~ ${body.endDate}`,
    });

    return success(c, { period });
  },
);

export default app;
