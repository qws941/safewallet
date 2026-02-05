import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { ThrottlerGuard } from "@nestjs/throttler";
import * as crypto from "crypto";

describe("VotesController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let voterAccessToken: string;
  let voterId: string;
  let candidateUserId: string;
  let voteCandidateId: string;
  let testSiteId: string;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const voterUser = {
    name: "김투표",
    phone: "01011112222",
    dob: "880101",
  };

  const candidateUser = {
    name: "이후보",
    phone: "01033334444",
    dob: "900202",
  };

  const hmac = (value: string) => {
    const secret = process.env.HMAC_SECRET || "default-hmac-secret";
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
  };

  beforeAll(async () => {
    process.env.REQUIRE_ATTENDANCE_FOR_LOGIN = "false";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    const site = await prisma.site.findFirst();
    if (!site) {
      throw new Error("No site found - create one first");
    }
    testSiteId = site.id;

    await prisma.vote.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.voteCandidate.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.siteMembership.deleteMany({
      where: {
        user: {
          phoneHash: { in: [hmac(voterUser.phone), hmac(candidateUser.phone)] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        phoneHash: { in: [hmac(voterUser.phone), hmac(candidateUser.phone)] },
      },
    });

    const voter = await prisma.user.create({
      data: {
        name: voterUser.name,
        phone: voterUser.phone,
        phoneHash: hmac(voterUser.phone),
        dob: voterUser.dob,
        dobHash: hmac(voterUser.dob),
        role: "WORKER",
      },
    });
    voterId = voter.id;

    await prisma.siteMembership.create({
      data: {
        siteId: testSiteId,
        userId: voterId,
        role: "WORKER",
      },
    });

    await prisma.attendance.create({
      data: {
        siteId: testSiteId,
        userId: voterId,
        externalWorkerId: "EXT-VOTER-001",
        checkinAt: new Date(),
        result: "SUCCESS",
        source: "FAS",
      },
    });

    const candidate = await prisma.user.create({
      data: {
        name: candidateUser.name,
        phone: candidateUser.phone,
        phoneHash: hmac(candidateUser.phone),
        dob: candidateUser.dob,
        dobHash: hmac(candidateUser.dob),
        role: "WORKER",
      },
    });
    candidateUserId = candidate.id;

    await prisma.voteCandidate.create({
      data: {
        siteId: testSiteId,
        month: currentMonth,
        userId: candidateUserId,
        source: "ADMIN",
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send(voterUser);

    voterAccessToken =
      loginResponse.body.data?.accessToken || loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.vote.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.voteCandidate.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.siteMembership.deleteMany({
      where: { userId: { in: [voterId, candidateUserId] } },
    });
    await prisma.user.deleteMany({
      where: {
        phoneHash: { in: [hmac(voterUser.phone), hmac(candidateUser.phone)] },
      },
    });
    await app.close();
  });

  describe("GET /votes/current", () => {
    it("should return current vote info with candidates", async () => {
      const response = await request(app.getHttpServer())
        .get(`/votes/current?siteId=${testSiteId}`)
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .expect(200);

      const data = response.body.data || response.body;
      expect(data).toHaveProperty("month", currentMonth);
      expect(data).toHaveProperty("candidates");
      expect(Array.isArray(data.candidates)).toBe(true);
      expect(data).toHaveProperty("hasVoted");
    });

    it("should fail without auth token", async () => {
      await request(app.getHttpServer())
        .get(`/votes/current?siteId=${testSiteId}`)
        .expect(401);
    });

    it("should return result when siteId is omitted", async () => {
      await request(app.getHttpServer())
        .get("/votes/current")
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .expect(200);
    });
  });

  describe("POST /votes", () => {
    afterEach(async () => {
      await prisma.vote.deleteMany({
        where: { voterId, siteId: testSiteId, month: currentMonth },
      });
    });

    it("should cast vote successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/votes")
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
          candidateId: candidateUserId,
        })
        .expect(201);

      const data = response.body.data || response.body;
      expect(data).toHaveProperty("success", true);
    });

    it("should prevent duplicate votes", async () => {
      await request(app.getHttpServer())
        .post("/votes")
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
          candidateId: candidateUserId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post("/votes")
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
          candidateId: candidateUserId,
        })
        .expect(400);
    });

    it("should fail without auth token", async () => {
      await request(app.getHttpServer())
        .post("/votes")
        .send({
          siteId: testSiteId,
          candidateId: candidateUserId,
        })
        .expect(401);
    });

    it("should fail with missing candidateId", async () => {
      await request(app.getHttpServer())
        .post("/votes")
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
        })
        .expect(400);
    });
  });

  describe("GET /votes/results", () => {
    beforeAll(async () => {
      await prisma.vote.create({
        data: {
          siteId: testSiteId,
          month: currentMonth,
          voterId,
          candidateId: candidateUserId,
        },
      });
    });

    afterAll(async () => {
      await prisma.vote.deleteMany({
        where: { voterId, siteId: testSiteId, month: currentMonth },
      });
    });

    it("should return vote results", async () => {
      const response = await request(app.getHttpServer())
        .get(`/votes/results?siteId=${testSiteId}&month=${currentMonth}`)
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .expect(200);

      const data = response.body.data || response.body;
      expect(data).toHaveProperty("month", currentMonth);
      expect(data).toHaveProperty("results");
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results.length).toBeGreaterThan(0);
    });

    it("should fail without auth token", async () => {
      await request(app.getHttpServer())
        .get(`/votes/results?siteId=${testSiteId}&month=${currentMonth}`)
        .expect(401);
    });

    it("should return result when siteId is omitted", async () => {
      await request(app.getHttpServer())
        .get(`/votes/results?month=${currentMonth}`)
        .set("Authorization", `Bearer ${voterAccessToken}`)
        .expect(200);
    });
  });
});
