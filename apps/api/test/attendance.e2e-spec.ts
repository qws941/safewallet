import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { ThrottlerGuard } from "@nestjs/throttler";
import * as crypto from "crypto";

describe("AttendanceController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testUserId: string;
  let testSiteId: string;

  const testUser = {
    name: "김출근",
    phone: "01098765432",
    dob: "850515",
  };

  const hmac = (value: string) => {
    const secret = process.env.HMAC_SECRET || "default-hmac-secret";
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
  };

  const normalizePhone = (phone: string) => phone.replace(/-/g, "");

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

    let site = await prisma.site.findFirst();
    if (!site) {
      site = await prisma.site.create({
        data: {
          name: "Test Site",
          joinCode: "TEST123",
        },
      });
    }
    testSiteId = site.id;

    await prisma.user.deleteMany({
      where: { phoneHash: hmac(normalizePhone(testUser.phone)) },
    });

    const user = await prisma.user.create({
      data: {
        name: testUser.name,
        phone: testUser.phone,
        phoneHash: hmac(normalizePhone(testUser.phone)),
        dob: testUser.dob,
        dobHash: hmac(testUser.dob),
        externalWorkerId: "EXT-ATTEND-001",
        role: "WORKER",
      },
    });
    testUserId = user.id;

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send(testUser);

    accessToken =
      loginResponse.body.data?.accessToken || loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { phoneHash: hmac(normalizePhone(testUser.phone)) },
    });
    await app.close();
  });

  describe("POST /attendance/sync", () => {
    afterEach(async () => {
      await prisma.attendance.deleteMany({
        where: { userId: testUserId },
      });
    });

    it("should sync attendance successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/attendance/sync")
        .send({
          siteId: testSiteId,
          externalWorkerId: "EXT-ATTEND-001",
          checkinAt: new Date().toISOString(),
          result: "SUCCESS",
          deviceId: "FAS-001",
        })
        .expect(201);

      const data = response.body.data || response.body;
      expect(data).toHaveProperty("attendanceId");
      expect(data.success).toBe(true);
    });

    it("should handle FAIL result", async () => {
      const response = await request(app.getHttpServer())
        .post("/attendance/sync")
        .send({
          siteId: testSiteId,
          externalWorkerId: "EXT-ATTEND-001",
          checkinAt: new Date().toISOString(),
          result: "FAIL",
          deviceId: "FAS-001",
        })
        .expect(201);

      const data = response.body.data || response.body;
      expect(data).toHaveProperty("attendanceId");
    });

    it("should fail with missing required fields", async () => {
      await request(app.getHttpServer())
        .post("/attendance/sync")
        .send({
          siteId: testSiteId,
        })
        .expect(400);
    });
  });

  describe("GET /attendance/today", () => {
    beforeAll(async () => {
      await prisma.attendance.create({
        data: {
          siteId: testSiteId,
          userId: testUserId,
          externalWorkerId: "EXT-ATTEND-001",
          checkinAt: new Date(),
          result: "SUCCESS",
          source: "FAS",
        },
      });
    });

    afterAll(async () => {
      await prisma.attendance.deleteMany({
        where: { userId: testUserId },
      });
    });

    it("should return today attendance status", async () => {
      const response = await request(app.getHttpServer())
        .get(`/attendance/today?siteId=${testSiteId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const data = response.body.data || response.body;
      expect(data).toHaveProperty("attended");
      expect(data.attended).toBe(true);
      expect(data).toHaveProperty("checkinAt");
    });

    it("should fail without auth token", async () => {
      await request(app.getHttpServer())
        .get(`/attendance/today?siteId=${testSiteId}`)
        .expect(401);
    });

    it("should return result without siteId", async () => {
      await request(app.getHttpServer())
        .get("/attendance/today")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe("GET /attendance/today/list", () => {
    beforeAll(async () => {
      await prisma.attendance.create({
        data: {
          siteId: testSiteId,
          userId: testUserId,
          externalWorkerId: "EXT-ATTEND-001",
          checkinAt: new Date(),
          result: "SUCCESS",
          source: "FAS",
        },
      });
    });

    afterAll(async () => {
      await prisma.attendance.deleteMany({
        where: { userId: testUserId },
      });
    });

    it("should return today attendance list", async () => {
      const response = await request(app.getHttpServer())
        .get(`/attendance/today/list?siteId=${testSiteId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const data = response.body.data || response.body;
      expect(Array.isArray(data)).toBe(true);
    });

    it("should fail without auth token", async () => {
      await request(app.getHttpServer())
        .get(`/attendance/today/list?siteId=${testSiteId}`)
        .expect(401);
    });
  });
});
