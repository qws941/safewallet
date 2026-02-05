import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { ThrottlerGuard } from "@nestjs/throttler";
import * as crypto from "crypto";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const hmac = (value: string) => {
    const secret = process.env.HMAC_SECRET || "default-hmac-secret";
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
  };

  const normalizePhone = (phone: string) => phone.replace(/-/g, "");

  const createTestUser = async (userData: {
    name: string;
    phone: string;
    dob: string;
  }) => {
    await prisma.user.deleteMany({
      where: { phoneHash: hmac(normalizePhone(userData.phone)) },
    });

    return prisma.user.create({
      data: {
        name: userData.name,
        phone: userData.phone,
        phoneHash: hmac(normalizePhone(userData.phone)),
        dob: userData.dob,
        dobHash: hmac(userData.dob),
        role: "WORKER",
      },
    });
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { phone: { startsWith: "0101234" } },
          { phone: { startsWith: "0109876" } },
          { phone: { startsWith: "0105555" } },
        ],
      },
    });
    await app.close();
  });

  describe("POST /auth/login - validation", () => {
    it("should fail with missing fields", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ name: "홍길동" })
        .expect(400);
    });

    it("should fail with invalid phone format", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          name: "홍길동",
          phone: "123",
          dob: "900101",
        })
        .expect(400);
    });

    it("should fail with invalid dob format", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          name: "홍길동",
          phone: "01012345678",
          dob: "12345",
        })
        .expect(400);
    });
  });

  describe("POST /auth/login - authentication", () => {
    const loginUser = {
      name: "홍길동",
      phone: "01012345678",
      dob: "900101",
    };

    beforeAll(async () => {
      await createTestUser(loginUser);
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(normalizePhone(loginUser.phone)) },
      });
    });

    it("should login successfully with valid credentials", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send(loginUser)
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user).toHaveProperty("name", loginUser.name);
    });

    it("should fail with unregistered user", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          name: "미등록자",
          phone: "01099999999",
          dob: "990101",
        })
        .expect(401);

      expect(response.body.message).toContain("등록되지 않은 사용자");
    });

    it("should fail with wrong name", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          name: "김철수",
          phone: loginUser.phone,
          dob: loginUser.dob,
        })
        .expect(401);

      expect(response.body.message).toContain("이름");
    });
  });

  describe("POST /auth/refresh", () => {
    const refreshUser = {
      name: "김리프레시",
      phone: "01098765432",
      dob: "850515",
    };
    let refreshToken: string;

    beforeAll(async () => {
      await createTestUser(refreshUser);

      const loginResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send(refreshUser);

      refreshToken = loginResponse.body.refreshToken;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(normalizePhone(refreshUser.phone)) },
      });
    });

    it("should refresh token successfully", async () => {
      expect(refreshToken).toBeDefined();

      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
    });

    it("should fail with invalid refresh token", async () => {
      const invalidUUID = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: invalidUUID })
        .expect(401);
    });
  });

  describe("POST /auth/logout", () => {
    const logoutUser = {
      name: "이로그아웃",
      phone: "01055556666",
      dob: "880220",
    };
    let refreshToken: string;

    beforeAll(async () => {
      await createTestUser(logoutUser);

      const loginResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send(logoutUser);

      refreshToken = loginResponse.body.refreshToken;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(normalizePhone(logoutUser.phone)) },
      });
    });

    it("should logout successfully", async () => {
      expect(refreshToken).toBeDefined();

      await request(app.getHttpServer())
        .post("/auth/logout")
        .send({ refreshToken })
        .expect(200);
    });

    it("should fail without refresh token", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .send({})
        .expect(400);
    });
  });
});
