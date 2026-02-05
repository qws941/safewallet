import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as crypto from 'crypto';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    name: '홍길동',
    phone: '01012345678',
    dob: '900101',
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(testUser.phone + testUser.dob) },
      });

      await prisma.user.create({
        data: {
          name: testUser.name,
          phone: testUser.phone,
          phoneHash: hmac(testUser.phone + testUser.dob),
          dob: testUser.dob,
          dobHash: hmac(testUser.dob),
          role: 'WORKER',
        },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(testUser.phone + testUser.dob) },
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('name', testUser.name);
    });

    it('should fail with unregistered user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          name: '미등록자',
          phone: '01099999999',
          dob: '990101',
        })
        .expect(401);

      expect(response.body.message).toContain('등록되지 않은 사용자');
    });

    it('should fail with wrong name', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          name: '김철수',
          phone: testUser.phone,
          dob: testUser.dob,
        })
        .expect(401);

      expect(response.body.message).toContain('이름');
    });

    it('should fail with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ name: '홍길동' })
        .expect(400);
    });

    it('should fail with invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          name: testUser.name,
          phone: '123',
          dob: testUser.dob,
        })
        .expect(400);
    });

    it('should fail with invalid dob format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          name: testUser.name,
          phone: testUser.phone,
          dob: '12345',
        })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(testUser.phone + testUser.dob) },
      });

      await prisma.user.create({
        data: {
          name: testUser.name,
          phone: testUser.phone,
          phoneHash: hmac(testUser.phone + testUser.dob),
          dob: testUser.dob,
          dobHash: hmac(testUser.dob),
          role: 'WORKER',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser);

      refreshToken = loginResponse.body.refreshToken;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(testUser.phone + testUser.dob) },
      });
    });

    it('should refresh token successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
    });

    it('should fail with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(testUser.phone + testUser.dob) },
      });

      await prisma.user.create({
        data: {
          name: testUser.name,
          phone: testUser.phone,
          phoneHash: hmac(testUser.phone + testUser.dob),
          dob: testUser.dob,
          dobHash: hmac(testUser.dob),
          role: 'WORKER',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser);

      accessToken = loginResponse.body.accessToken;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { phoneHash: hmac(testUser.phone + testUser.dob) },
      });
    });

    it('should logout successfully', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });

    it('should fail without auth token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });
});
