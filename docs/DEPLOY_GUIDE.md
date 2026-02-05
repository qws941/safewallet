# SafetyWallet 배포 가이드

## 빌드 상태 ✅

| App | 빌드 | 명령어 |
|-----|------|--------|
| Worker App | ✅ 성공 | `npm run pages:build` |
| Admin App | ✅ 성공 | `npm run pages:build` |
| API | ✅ 성공 | `npm run build` |

---

## 1. Cloudflare Pages 배포

### 1.1 사전 준비

1. Cloudflare 계정 생성: https://dash.cloudflare.com
2. API 토큰 생성:
   - https://dash.cloudflare.com/profile/api-tokens
   - "Create Token" → "Edit Cloudflare Workers" 템플릿
   - 권한: Cloudflare Pages:Edit, Account Settings:Read

### 1.2 Worker App 배포

```bash
cd /home/jclee/dev/safework2/apps/worker-app

# 환경변수 설정
export CLOUDFLARE_API_TOKEN=your_token_here

# 빌드 (이미 완료됨)
NEXT_PUBLIC_API_URL=https://api.safework2.jclee.me npm run pages:build

# 배포
npm run pages:deploy
```

배포 URL: https://safework2-worker.pages.dev → safework2.jclee.me

### 1.3 Admin App 배포

```bash
cd /home/jclee/dev/safework2/apps/admin-app

# 환경변수 설정
export CLOUDFLARE_API_TOKEN=your_token_here

# 빌드 (이미 완료됨)
NEXT_PUBLIC_API_URL=https://api.safework2.jclee.me npm run pages:build

# 배포
npm run pages:deploy
```

배포 URL: https://safework2-admin.pages.dev → admin.safework2.jclee.me

### 1.4 커스텀 도메인 연결

1. Cloudflare Dashboard → Pages → 프로젝트 선택
2. Custom domains → Add custom domain
3. 도메인 입력: `safework2.jclee.me` 또는 `admin.safework2.jclee.me`

---

## 2. Fly.io API 배포

### 2.1 사전 준비

1. Fly.io 계정 생성: https://fly.io
2. Fly CLI 설치:
   ```bash
   curl -L https://fly.io/install.sh | sh
   export PATH="$HOME/.fly/bin:$PATH"
   ```
3. 로그인:
   ```bash
   flyctl auth login
   ```

### 2.2 API 배포

```bash
cd /home/jclee/dev/safework2/apps/api

# 앱 생성 (최초 1회)
flyctl launch --name safework2-api --region nrt --no-deploy

# 환경변수 설정
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="your-secret" \
  NODE_ENV="production"

# 배포
flyctl deploy
```

배포 URL: https://safework2-api.fly.dev → api.safework2.jclee.me

### 2.3 Dockerfile 생성 (필요시)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/
RUN npm ci
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## 3. 데이터베이스 설정 (Neon PostgreSQL)

### 3.1 Neon 프로젝트 생성

1. https://neon.tech 접속
2. 새 프로젝트 생성
3. Connection string 복사

### 3.2 Prisma 마이그레이션

```bash
cd /home/jclee/dev/safework2/packages/database

# 환경변수 설정
export DATABASE_URL="postgresql://..."

# 마이그레이션 실행
npx prisma migrate deploy
```

---

## 4. DNS 설정 (이미 완료됨)

| 도메인 | 타입 | 대상 | Proxy |
|--------|------|------|-------|
| safework2.jclee.me | CNAME | safework2-worker.pages.dev | Yes |
| admin.safework2.jclee.me | CNAME | safework2-admin.pages.dev | Yes |
| api.safework2.jclee.me | CNAME | safework2-api.fly.dev | No |

---

## 5. 환경변수 체크리스트

### Worker App / Admin App
- [ ] `NEXT_PUBLIC_API_URL` - API 서버 URL

### API
- [ ] `DATABASE_URL` - PostgreSQL 연결 문자열
- [ ] `JWT_SECRET` - JWT 서명 키
- [ ] `NODE_ENV` - production

---

## 6. 배포 후 확인

1. Worker App: https://safework2.jclee.me
2. Admin App: https://admin.safework2.jclee.me
3. API Health: https://api.safework2.jclee.me/health

---

## 빠른 배포 명령어

```bash
# 전체 빌드
cd /home/jclee/dev/safework2
npm run build --workspaces

# Worker App 배포
cd apps/worker-app && npm run pages:deploy

# Admin App 배포
cd apps/admin-app && npm run pages:deploy

# API 배포
cd apps/api && flyctl deploy
```
