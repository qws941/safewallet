import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as crypto from 'crypto';

describe('VotesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let voterAccessToken: string;
  let voterId: string;
  let candidateId: string;
  let testSiteId: string;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const voterUser = {
    name: '김투표',
    phone: '01011112222',
    dob: '880101',
  };

  const candidateUser = {
    name: '이후보',
    phone: '01033334444',
    dob: '900202',
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

    await prisma.vote.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.voteCandidate.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.user.deleteMany({
      where: { phone: { in: [voterUser.phone, candidateUser.phone] } },
    });

    const voter = await prisma.user.create({
      data: {
        name: voterUser.name,
        phone: voterUser.phone,
        phoneHash: hmac(voterUser.phone + voterUser.dob),
        dob: voterUser.dob,
        dobHash: hmac(voterUser.dob),
        role: 'WORKER',
      },
    });
    voterId = voter.id;

    const candidate = await prisma.user.create({
      data: {
        name: candidateUser.name,
        phone: candidateUser.phone,
        phoneHash: hmac(candidateUser.phone + candidateUser.dob),
        dob: candidateUser.dob,
        dobHash: hmac(candidateUser.dob),
        role: 'WORKER',
      },
    });

    const voteCandidate = await prisma.voteCandidate.create({
      data: {
        siteId: testSiteId,
        month: currentMonth,
        userId: candidate.id,
        source: 'ADMIN',
      },
    });
    candidateId = voteCandidate.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(voterUser);

    voterAccessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.vote.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.voteCandidate.deleteMany({
      where: { siteId: testSiteId, month: currentMonth },
    });
    await prisma.user.deleteMany({
      where: { phone: { in: [voterUser.phone, candidateUser.phone] } },
    });
    await app.close();
  });

  describe('GET /votes/current', () => {
    it('should return current vote info with candidates', async () => {
      const response = await request(app.getHttpServer())
        .get(`/votes/current?siteId=${testSiteId}`)
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('month', currentMonth);
      expect(response.body).toHaveProperty('candidates');
      expect(Array.isArray(response.body.candidates)).toBe(true);
      expect(response.body).toHaveProperty('hasVoted');
    });

    it('should fail without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/votes/current?siteId=${testSiteId}`)
        .expect(401);
    });

    it('should fail without siteId', async () => {
      await request(app.getHttpServer())
        .get('/votes/current')
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .expect(400);
    });
  });

  describe('POST /votes', () => {
    afterEach(async () => {
      await prisma.vote.deleteMany({
        where: { voterId, siteId: testSiteId, month: currentMonth },
      });
    });

    it('should cast vote successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/votes')
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
          candidateId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('month', currentMonth);
    });

    it('should prevent duplicate votes', async () => {
      await request(app.getHttpServer())
        .post('/votes')
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
          candidateId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/votes')
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
          candidateId,
        })
        .expect(409);
    });

    it('should fail without auth token', async () => {
      await request(app.getHttpServer())
        .post('/votes')
        .send({
          siteId: testSiteId,
          candidateId,
        })
        .expect(401);
    });

    it('should fail with missing candidateId', async () => {
      await request(app.getHttpServer())
        .post('/votes')
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .send({
          siteId: testSiteId,
        })
        .expect(400);
    });
  });

  describe('GET /votes/results', () => {
    beforeAll(async () => {
      await prisma.vote.create({
        data: {
          siteId: testSiteId,
          month: currentMonth,
          voterId,
          candidateId,
        },
      });
    });

    afterAll(async () => {
      await prisma.vote.deleteMany({
        where: { voterId, siteId: testSiteId, month: currentMonth },
      });
    });

    it('should return vote results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/votes/results?siteId=${testSiteId}&month=${currentMonth}`)
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('month', currentMonth);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body).toHaveProperty('totalVotes');
    });

    it('should fail without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/votes/results?siteId=${testSiteId}&month=${currentMonth}`)
        .expect(401);
    });

    it('should fail without siteId', async () => {
      await request(app.getHttpServer())
        .get(`/votes/results?month=${currentMonth}`)
        .set('Authorization', `Bearer ${voterAccessToken}`)
        .expect(400);
    });
  });
});
