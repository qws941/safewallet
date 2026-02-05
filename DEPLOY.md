# SafetyWallet 배포 가이드

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│ Cloudflare Pages (Next.js 14 Apps)                  │
│ ├─ safework2.jclee.me (Worker App)                  │
│ └─ admin.safework2.jclee.me (Admin App)             │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Fly.io (NestJS API)                                 │
│ └─ api.safework2.jclee.me                           │
└─────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────┬──────────────────────────────┐
│ Neon PostgreSQL      │ Cloudflare R2                │
│ (Database)           │ (File Storage)               │
└──────────────────────┴──────────────────────────────┘
```

## 1. 사전 준비

### 필요한 계정
- [Cloudflare](https://dash.cloudflare.com) - Pages, R2, DNS
- [Fly.io](https://fly.io) - API 호스팅
- [Neon](https://neon.tech) - PostgreSQL

### 필요한 CLI 도구
```bash
npm install -g wrangler
curl -L https://fly.io/install.sh | sh
```

## 2. 데이터베이스 설정 (Neon)

1. https://console.neon.tech 에서 프로젝트 생성
2. Connection string 복사:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

## 3. Cloudflare R2 버킷 생성

```bash
wrangler r2 bucket create safework2-uploads
```

## 4. Fly.io API 배포

```bash
cd apps/api

# Fly.io 로그인
fly auth login

# 앱 생성 (최초 1회)
fly launch --name safework2-api --region nrt --no-deploy

# 시크릿 설정
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="your-jwt-secret"
fly secrets set CLOUDFLARE_ACCOUNT_ID="your-account-id"
fly secrets set R2_ACCESS_KEY_ID="your-r2-access-key"
fly secrets set R2_SECRET_ACCESS_KEY="your-r2-secret-key"

# 배포
fly deploy

# 커스텀 도메인 연결
fly certs add api.safework2.jclee.me
```

## 5. Cloudflare Pages 배포

### Worker App
```bash
cd apps/worker-app

# Cloudflare 로그인
wrangler login

# Pages 프로젝트 생성 (최초 1회)
wrangler pages project create safework2-worker

# 빌드 및 배포
NEXT_PUBLIC_API_URL=https://api.safework2.jclee.me npm run build
wrangler pages deploy .next --project-name=safework2-worker

# 커스텀 도메인 설정 (Cloudflare Dashboard에서)
# safework2.jclee.me → safework2-worker.pages.dev
```

### Admin App
```bash
cd apps/admin-app

# Pages 프로젝트 생성 (최초 1회)
wrangler pages project create safework2-admin

# 빌드 및 배포
NEXT_PUBLIC_API_URL=https://api.safework2.jclee.me npm run build
wrangler pages deploy .next --project-name=safework2-admin

# 커스텀 도메인 설정 (Cloudflare Dashboard에서)
# admin.safework2.jclee.me → safework2-admin.pages.dev
```

## 6. DNS 레코드 (이미 설정됨)

| Type  | Name             | Content                      | Proxied |
|-------|------------------|------------------------------|---------|
| CNAME | safework2        | safework2-worker.pages.dev   | ✅      |
| CNAME | admin.safework2  | safework2-admin.pages.dev    | ✅      |
| CNAME | api.safework2    | safework2-api.fly.dev        | ❌      |

## 7. GitHub Actions (자동 배포)

GitHub Secrets 설정:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID
- `FLY_API_TOKEN`: Fly.io API 토큰

`.github/workflows/deploy.yml` 파일이 이미 설정되어 있음.
`main` 브랜치에 push하면 자동 배포됨.

## 8. 환경변수 요약

### Fly.io (API)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
NODE_ENV=production
PORT=3002
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

### Cloudflare Pages (Worker/Admin Apps)
```env
NEXT_PUBLIC_API_URL=https://api.safework2.jclee.me
```

## 9. 로컬 개발

```bash
# 전체 빌드
npm run build

# 개발 서버 실행
npm run dev

# API만 실행
cd apps/api && npm run start:dev

# Worker App만 실행
cd apps/worker-app && npm run dev
```

## 10. 문제 해결

### API 배포 실패
```bash
fly logs -a safework2-api
```

### Pages 배포 실패
```bash
wrangler pages deployment list --project-name=safework2-worker
wrangler pages deployment tail --project-name=safework2-worker
```

### 데이터베이스 연결 확인
```bash
fly ssh console -a safework2-api
curl localhost:3002/health
```
