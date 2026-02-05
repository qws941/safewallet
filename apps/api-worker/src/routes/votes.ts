import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { votes, voteCandidates, users, siteMemberships } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { attendanceMiddleware } from "../middleware/attendance";
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

votesRoute.post("/", authMiddleware, async (c) => {
  const { user } = c.get("auth");

  let body: SubmitVoteBody;
  try {
    body = await c.req.json();
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON", 400);
  }

  if (!body.candidateId) {
    return error(c, "MISSING_CANDIDATE_ID", "candidateId is required", 400);
  }

  await attendanceMiddleware(c, async () => {}, body.siteId);

  const { candidateId } = body;
  const db = drizzle(c.env.DB);
  const currentMonth = getCurrentMonth();

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

  const candidate = await db
    .select()
    .from(voteCandidates)
    .where(
      and(
        eq(voteCandidates.siteId, siteId),
        eq(voteCandidates.month, currentMonth),
        eq(voteCandidates.userId, candidateId),
      ),
    )
    .get();

  if (!candidate) {
    return error(c, "INVALID_CANDIDATE", "유효하지 않은 후보입니다.", 400);
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

  if (existingVote) {
    return error(c, "ALREADY_VOTED", "이미 투표하셨습니다.", 400);
  }

  if (candidateId === user.id) {
    return error(c, "CANNOT_VOTE_SELF", "자신에게 투표할 수 없습니다.", 400);
  }

  await db.insert(votes).values({
    siteId,
    month: currentMonth,
    voterId: user.id,
    candidateId,
  });

  return success(c, { message: "투표가 완료되었습니다." });
});

export default votesRoute;
