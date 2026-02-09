import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import {
  votes,
  voteCandidates,
  votePeriods,
  users,
  siteMemberships,
} from "../db/schema";
import { CastVoteSchema } from "../validators/schemas";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
import { logAuditWithContext } from "../lib/audit";
import { success, error } from "../lib/response";
import type { Env, AuthContext } from "../types";

interface SubmitVoteBody {
  candidateId: string;
  siteId?: string;
}

const votesRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

function getCurrentMonth(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().slice(0, 7);
}

votesRoute.get("/current", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const currentMonth = getCurrentMonth();

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return success(c, {
      vote: null,
      message: "현재 활성화된 현장이 없습니다.",
    });
  }

  const siteId = membership.siteId;

  const candidates = await db
    .select({
      id: voteCandidates.id,
      userId: voteCandidates.userId,
      source: voteCandidates.source,
      userName: users.name,
      userNameMasked: users.nameMasked,
    })
    .from(voteCandidates)
    .leftJoin(users, eq(voteCandidates.userId, users.id))
    .where(
      and(
        eq(voteCandidates.siteId, siteId),
        eq(voteCandidates.month, currentMonth),
      ),
    )
    .all();

  if (candidates.length === 0) {
    return success(c, {
      vote: null,
      message: "현재 진행 중인 투표가 없습니다.",
    });
  }

  const existingVote = await db
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.siteId, siteId),
        eq(votes.month, currentMonth),
        eq(votes.voterId, user.id),
      ),
    )
    .get();

  const voteCounts = await db
    .select({
      candidateId: votes.candidateId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(votes)
    .where(and(eq(votes.siteId, siteId), eq(votes.month, currentMonth)))
    .groupBy(votes.candidateId)
    .all();

  const voteCountMap = new Map(
    voteCounts.map((vc) => [vc.candidateId, vc.count]),
  );

  return success(c, {
    vote: {
      siteId,
      month: currentMonth,
      candidates: candidates.map((cand) => ({
        id: cand.id,
        userId: cand.userId,
        name: cand.userNameMasked || cand.userName || "익명",
        source: cand.source,
        voteCount: voteCountMap.get(cand.userId) || 0,
      })),
    },
    hasVoted: !!existingVote,
    votedCandidateId: existingVote?.candidateId || null,
  });
});

// GET /my - 내 투표 이력
votesRoute.get("/my", authMiddleware, async (c) => {
  const { user } = c.get("auth");
  const db = drizzle(c.env.DB);

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return error(c, "NO_ACTIVE_SITE", "활성 현장이 없습니다", 400);
  }

  const myVotes = await db
    .select({
      id: votes.id,
      month: votes.month,
      candidateId: votes.candidateId,
      candidateName: users.nameMasked,
      votedAt: votes.votedAt,
    })
    .from(votes)
    .innerJoin(users, eq(votes.candidateId, users.id))
    .where(and(eq(votes.siteId, membership.siteId), eq(votes.voterId, user.id)))
    .orderBy(sql`${votes.month} DESC`);

  return success(c, { votes: myVotes });
});

votesRoute.post(
  "/",
  authMiddleware,
  zValidator("json", CastVoteSchema),
  async (c) => {
    const { user } = c.get("auth");

    const body = c.req.valid("json") as SubmitVoteBody;

    if (!body.candidateId) {
      return error(c, "MISSING_CANDIDATE_ID", "candidateId is required", 400);
    }

    await attendanceMiddleware(c, async () => {}, body.siteId);

    const { candidateId } = body;
    const db = drizzle(c.env.DB);

    const membershipConditions = [
      eq(siteMemberships.userId, user.id),
      eq(siteMemberships.status, "ACTIVE"),
    ];

    if (body.siteId) {
      membershipConditions.push(eq(siteMemberships.siteId, body.siteId));
    }

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(and(...membershipConditions))
      .get();

    if (!membership) {
      return error(c, "NO_ACTIVE_SITE", "활성화된 현장이 없습니다.", 400);
    }

    const siteId = membership.siteId;
    const nowEpoch = Math.floor(Date.now() / 1000);

    const activePeriod = await db
      .select({
        id: votePeriods.id,
        month: votePeriods.month,
      })
      .from(votePeriods)
      .where(
        and(
          eq(votePeriods.siteId, siteId),
          lte(votePeriods.startDate, nowEpoch),
          gte(votePeriods.endDate, nowEpoch),
          sql`status = 'ACTIVE'`,
        ),
      )
      .get();

    if (!activePeriod) {
      return error(c, "VOTING_CLOSED", "No active voting period");
    }

    const activePeriodMonth = activePeriod.month;

    const candidate = await db
      .select()
      .from(voteCandidates)
      .where(
        and(
          eq(voteCandidates.siteId, siteId),
          eq(voteCandidates.month, activePeriodMonth),
          eq(voteCandidates.userId, candidateId),
        ),
      )
      .get();

    if (!candidate) {
      return error(c, "INVALID_CANDIDATE", "유효하지 않은 후보입니다.", 400);
    }

    const existingVote = await db
      .select({ id: votes.id })
      .from(votes)
      .where(
        and(
          eq(votes.siteId, siteId),
          eq(votes.month, activePeriodMonth),
          eq(votes.voterId, user.id),
        ),
      )
      .get();

    if (existingVote) {
      return error(c, "DUPLICATE_VOTE", "Already voted in this period");
    }

    if (candidateId === user.id) {
      return error(c, "CANNOT_VOTE_SELF", "자신에게 투표할 수 없습니다.", 400);
    }

    await db.insert(votes).values({
      siteId,
      month: activePeriodMonth,
      voterId: user.id,
      candidateId,
    });

    try {
      await logAuditWithContext(
        c,
        db,
        "VOTE_CAST",
        user.id,
        "VOTE",
        `${siteId}:${activePeriodMonth}:${user.id}`,
        {
          siteId,
          month: activePeriodMonth,
          candidateId,
        },
      );
    } catch {
      // Do not block successful vote submission on audit failure.
    }

    return success(c, { message: "투표가 완료되었습니다." });
  },
);

export default votesRoute;
