import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as crypto from 'crypto';

describe('AttendanceController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testUserId: string;
  let testSiteId: string;

  const testUser = {
    name: '김출근',
    phone: '01098765432',
    dob: '850515',
  };

  const hmac = (value: string) => {
    const secret = process.env.HMAC_SECRET || 'test-secret';
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();

    const site = await prisma.site.findFirst();
    testSiteId = site?.id || 'test-site';

    await prisma.user.deleteMany({
      where: { phone: testUser.phone },
    });

    const user = await prisma.user.create({
      data: {
        name: testUser.name,
        phone: testUser.phone,
        phoneHash: hmac(testUser.phone + testUser.dob),
        dob: testUser.dob,
        dobHash: hmac(testUser.dob),
        externalWorkerId: 'EXT-001',
        role: 'WORKER',
      },
    });
    testUserId = user.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser);

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { phone: testUser.phone },
    });
    await app.close();
  });

  describe('POST /attendance/sync', () => {
    afterEach(async () => {
      await prisma.attendance.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('should sync attendance successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/attendance/sync')
        .send({
          siteId: testSiteId,
          externalWorkerId: 'EXT-001',
          checkinAt: new Date().toISOString(),
          result: 'SUCCESS',
          deviceId: 'FAS-001',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.result).toBe('SUCCESS');
    });

    it('should handle FAIL result', async () => {
      const response = await request(app.getHttpServer())
        .post('/attendance/sync')
        .send({
          siteId: testSiteId,
          externalWorkerId: 'EXT-001',
          checkinAt: new Date().toISOString(),
          result: 'FAIL',
          deviceId: 'FAS-001',
        })
        .expect(201);

      expect(response.body.result).toBe('FAIL');
    });

    it('should fail with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/attendance/sync')
        .send({
          siteId: testSiteId,
        })
        .expect(400);
    });
  });

  describe('GET /attendance/today', () => {
    beforeAll(async () => {
      await prisma.attendance.create({
        data: {
          siteId: testSiteId,
          userId: testUserId,
          externalWorkerId: 'EXT-001',
          checkinAt: new Date(),
          result: 'SUCCESS',
          source: 'FAS',
        },
      });
    });

    afterAll(async () => {
      await prisma.attendance.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('should return today attendance status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/attendance/today?siteId=${testSiteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('checkedIn');
      expect(response.body.checkedIn).toBe(true);
      expect(response.body).toHaveProperty('checkinAt');
    });

    it('should fail without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/attendance/today?siteId=${testSiteId}`)
        .expect(401);
    });

    it('should fail without siteId', async () => {
      await request(app.getHttpServer())
        .get('/attendance/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /attendance/today/list', () => {
    beforeAll(async () => {
      await prisma.attendance.create({
        data: {
          siteId: testSiteId,
          userId: testUserId,
          externalWorkerId: 'EXT-001',
          checkinAt: new Date(),
          result: 'SUCCESS',
          source: 'FAS',
        },
      });
    });

    afterAll(async () => {
      await prisma.attendance.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('should return today attendance list', async () => {
      const response = await request(app.getHttpServer())
        .get(`/attendance/today/list?siteId=${testSiteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('records');
      expect(Array.isArray(response.body.records)).toBe(true);
    });

    it('should fail without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/attendance/today/list?siteId=${testSiteId}`)
        .expect(401);
    });
  });
});
