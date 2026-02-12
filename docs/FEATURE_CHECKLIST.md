# 안전지갑 기능 체크리스트

> 최종 업데이트: 2026-02-12

## 1. 사용자 인증 (Authentication)

### 1.1 로그인

- [x] 이름 입력 필드
- [x] 전화번호 입력 필드 (숫자만, 정규화)
- [x] 생년월일 입력 필드 (YYMMDD 6자리)
- [x] 로그인 버튼
- [x] 로그인 실패 메시지
  - [x] "등록되지 않은 사용자입니다" (FAS 미등록)
  - [x] "오늘 출근 인증이 확인되지 않습니다" (미출석) ✅ NEW
  - [x] "이름이 일치하지 않습니다" (정보 불일치)
- [x] Rate limiting (무차별 대입 방지) ✅ NEW - 5 req/min on login
- [x] 로그인 시도 횟수 제한 (계정 잠금) ✅ NEW - 5회 실패 시 30분 잠금

### 1.2 기존 기능 제거

- [x] 회원가입 버튼/페이지 제거 (OTP 기반 회원가입 제거)
- [x] QR 체크인 기능 제거 (해당 없음)
- [x] 소셜 로그인 제거 (해당 없음)

### 1.3 세션 관리

- [x] JWT 토큰 발급 (24시간 TTL)
- [x] 자정 통과 시 재로그인 요구 ✅ NEW
- [x] 로그아웃 기능

---

## 2. FAS 연동 (Face Attendance System Integration)

### 2.1 근로자 마스터 동기화

- [x] FAS 근로자 등록 → SW 사용자 자동 생성 ✅ NEW - POST /fas/workers/sync
- [x] 동기화 필드:
  - [x] 현장 ID (site_id)
  - [x] 협력업체 (company_name)
  - [x] 공정 (trade_type)
  - [x] 이름 (name)
  - [x] 전화번호 (phone) - HMAC 저장 (phoneHash)
  - [x] 생년월일 (dob) - HMAC 저장 (dobHash)
  - [x] 근로자코드 (external_worker_id)
- [x] 정보 변경 시 업데이트 ✅ NEW - upsert logic
- [x] 비활성화/삭제 처리 ✅ NEW - DELETE /fas/workers/:id

### 2.2 출근 이벤트 동기화

- [x] 출근 로그 수신/저장 (POST /attendance/sync)
- [x] 동기화 필드:
  - [x] 현장 ID
  - [x] 근로자코드
  - [x] 출근시간
  - [x] 인증결과 (성공/실패)
  - [x] 장비 ID (옵션)
- [x] 중복 방지 (Idempotency) ✅ - Idempotency-Key 헤더 + onConflictDoNothing
- [x] 재처리 로직 ✅ - withRetry 3회 + syncErrors 테이블 기록

### 2.3 연동 방식

- [x] A안: API/Webhook (실시간) - POST /attendance/sync, POST /fas/workers/sync
- [x] ~~B안: DB Polling~~ → N/A (A안 FAS 실시간 동기화 채택)
- [x] ~~C안: CSV Import~~ → N/A (A안 FAS 실시간 동기화 채택)

---

## 3. 출근 인증 기반 접근 제어 (Access Control)

### 3.1 출근 상태 확인

- [x] 오늘 출근 로그 조회 API (GET /attendance/today)
- [x] 출근 유효성 판정 (success만 유효)
- [x] Day cutoff 적용 (05:00 기준) ✅ NEW

### 3.2 접근 제한

- [x] 미출근자 로그인 차단 ✅ NEW - ForbiddenException in AuthService
- [x] 미출근자 기능 비활성화: ✅ NEW - AttendanceGuard
  - [x] 게시물 열람 불가
  - [x] 게시물 등록 불가
  - [x] 투표 불가
  - [ ] 포인트/랭킹 열람 불가 (정책 결정 필요)
- [x] 안내 메시지: "게이트 안면인식 출근 후 이용 가능합니다"

### 3.3 다현장 지원

- [x] 현장별 출근 로그 구분 (siteId 파라미터)
- [x] 해당 현장 출근 시에만 접속 허용 ✅ NEW - accessPolicies per-site + attendanceMiddleware 연동

---

## 4. 메인 화면 (Worker App)

### 4.1 출근 인증 상태

- [x] 상태 표시 (읽기 전용)
  - [x] "오늘 출근 인증: 완료 (09:15)"
  - [x] "오늘 출근 인증: 미완료"
- [x] FAS 연동 결과 실시간 반영

### 4.2 포인트 현황

- [x] 현재 포인트 표시
- [x] 포인트 상세 내역 페이지

### 4.3 안전 행동요령

- [x] 안전 공지 목록
- [x] 공지 상세 보기

### 4.4 안전 제안/신고

- [x] 제보 등록 기능
- [x] 사진 첨부
- [x] 제보 목록/상세

### 4.5 우수근로자 투표

- [x] 투표 버튼 (조건부 활성화)
- [x] 투표 페이지 이동

---

## 5. 우수근로자 투표 (Monthly Voting)

### 5.1 투표 자격

- [x] 당일 출근 인증 확인 - AttendanceGuard on POST /votes
- [x] 미출근자 투표 버튼 비활성화 ✅ (서버에서 차단)

### 5.2 투표 기간

- [x] 월별 투표 (매월 1일~말일)
- [x] 투표 기간 표시

### 5.3 후보 목록

- [x] 관리자 등록 후보 표시
- [x] ~~(옵션) 포인트 상위 N명 자동 후보~~ → N/A (관리자 수동 등록으로 운영)
- [x] 후보 정보: 마스킹된 이름, 업체, 공정

### 5.4 투표 기능

- [x] 1인 1표 제한 (DB unique constraint)
- [x] 후보 선택 UI
- [x] 투표 확인 다이얼로그
- [x] 투표 완료 메시지
- [x] 중복 투표 방지 (ConflictException)

### 5.5 결과 조회

- [x] 상위 3명 마스킹 표시 (근로자)
- [x] 투표 마감 후 결과 공개

---

## 6. 포인트 시스템

### 6.1 포인트 조회

- [x] 현재 보유 포인트
- [x] 포인트 내역 (적립/사용)
- [x] 기간별 조회

### 6.2 포인트 적립

- [x] 안전 제보 적립
- [x] 안전 퀴즈 적립
- [x] 관리자 수동 적립

### 6.3 랭킹

- [x] 현장 내 랭킹
- [x] 월별/주별 랭킹

---

## 7. 게시물 (Posts)

### 7.1 게시물 목록

- [x] 최신순 정렬
- [x] 카테고리 필터
- [x] 무한 스크롤/페이지네이션

### 7.2 게시물 상세

- [x] 제목, 내용, 작성자
- [x] 첨부 이미지
- [x] 좋아요/댓글

### 7.3 게시물 작성

- [x] 제목 입력
- [x] 내용 입력
- [x] 이미지 첨부 (다중)
- [x] 카테고리 선택
- [x] 등록/취소

---

## 8. 관리자 기능 (Admin App)

### 8.1 대시보드

- [x] 현장 통계 요약
- [x] 오늘 출근자 수
- [x] 게시물 현황
- [x] 투표 현황

### 8.2 근로자 동기화 상태

- [x] FAS 등록자 수 vs SW 계정 수 ✅ NEW - GET /admin/sync-status
- [x] 미매칭 목록 ✅ - GET /attendance/unmatched 구현됨
- [x] 최근 동기화 시간 ✅ NEW
- [x] 동기화 에러 내역 ✅ NEW - sync_errors 테이블 + admin API/UI

### 8.3 출근 로그 모니터링

- [x] 날짜별 조회
- [x] 현장별/업체별 필터 ✅ - 소속(업체) 드롭다운 필터 추가
- [x] 출근 로그 검색 ✅ - DataTable 검색 + 날짜/결과 필터
- [x] 이상치 표시 ✅ - 조기출근/지각/미퇴근/중복 감지, 이상치 통계 카드, 필터 토글

### 8.4 수동 출근 승인

- [x] 승인 대상 선택 ✅ NEW - POST /admin/manual-approval
- [x] 승인 사유 입력 (필수) ✅ NEW
- [x] 승인/반려 버튼 ✅ (approvals/approval-list.tsx 구현됨)
- [x] 승인 이력 조회 ✅ NEW - GET /admin/manual-approvals

### 8.5 회원 관리

- [x] 회원 목록
- [x] 회원 상세 정보
- [x] 회원 상태 변경 (활성/비활성)
- [x] 포인트 수동 조정

### 8.6 게시물 관리

- [x] 게시물 목록
- [x] 게시물 승인/반려
- [x] 게시물 삭제

### 8.7 투표 관리

- [x] 투표 기간 설정 ✅ - votes/page.tsx 투표 기간 UI (시작/종료일 설정)
- [x] 후보 등록/삭제
- [x] 투표 결과 조회 (실명/전체)
- [x] 결과 내보내기 ✅ - CSV 내보내기 버튼 (GET /admin/votes/results?format=csv)

### 8.8 공지 관리

- [x] 공지 등록/수정/삭제
- [x] 공지 예약 발송 ✅ - datetime-local 입력 + scheduledAt 필드

---

## 9. API 엔드포인트

### 9.1 인증 API

- [x] `POST /auth/login` - 로그인 (name+phone+dob HMAC + 출근체크)
- [x] `POST /auth/logout` - 로그아웃
- [x] `GET /auth/me` - 현재 사용자 정보 ✅ (auth.ts 구현됨)

### 9.2 FAS 연동 API ✅ NEW

- [x] `POST /fas/workers/sync` - 근로자 일괄 동기화
- [x] `DELETE /fas/workers/:id` - 근로자 삭제

### 9.3 출근 API

- [x] `GET /attendance/today` - 오늘 출근 로그
- [x] `GET /attendance/today/list` - 오늘 출근자 목록
- [x] `POST /attendance/sync` - 출근 동기화 (Webhook)

### 9.4 게시물 API

- [x] `GET /posts` - 목록 조회
- [x] `GET /posts/:id` - 상세 조회
- [x] `POST /posts` - 등록
- [x] `PUT /posts/:id` - 수정
- [x] `DELETE /posts/:id` - 삭제

### 9.5 투표 API

- [x] `GET /votes/current` - 현재 투표 정보 (후보 목록 포함)
- [x] `POST /votes` - 투표
- [x] `GET /votes/results` - 결과 조회
- [x] `GET /votes/my` - 내 투표 확인 ✅ (votes.ts 구현됨)

### 9.6 포인트 API

- [x] `GET /points` - 포인트 조회
- [x] `GET /points/history` - 내역 조회
- [x] `GET /points/ranking` - 랭킹

### 9.7 관리자 API

- [x] `GET /admin/sync-status` - 동기화 상태 ✅ NEW
- [x] `GET /admin/attendance-logs` - 출근 로그 ✅ (관리자 8.3 구현됨)
- [x] `POST /admin/manual-approval` - 수동 승인 ✅ NEW
- [x] `GET /admin/manual-approvals` - 수동 승인 목록 ✅ NEW
- [x] `GET /admin/users` - 회원 목록
- [x] `PUT /admin/users/:id` - 회원 수정

---

## 10. 데이터베이스 스키마

### 10.1 Users 테이블

- [x] id (PK)
- [x] external_system ('FAS')
- [x] external_worker_id
- [x] name, name_masked
- [x] phone_encrypted ✅ (구현됨 - phoneEncrypted)
- [x] phone_hash (검색용 HMAC)
- [x] dob_encrypted ✅ (구현됨 - dobEncrypted)
- [x] dob_hash (검색용 HMAC)
- [x] company_name, trade_type
- [x] role (WORKER, ADMIN, SUPER_ADMIN)
- [x] created_at, updated_at

### 10.2 Attendance 테이블

- [x] id (PK)
- [x] site_id
- [x] external_worker_id
- [x] user_id (FK)
- [x] checkin_at
- [x] result (SUCCESS/FAIL)
- [x] device_id
- [x] source ('FAS', 'MANUAL')
- [x] created_at

### 10.3 ManualApproval 테이블

- [x] id (PK)
- [x] user_id (FK)
- [x] site_id
- [x] approved_by_id (FK)
- [x] reason
- [x] valid_date
- [x] created_at

### 10.4 Vote 테이블

- [x] id (PK)
- [x] site_id
- [x] month (YYYY-MM)
- [x] voter_id (FK)
- [x] candidate_id (FK)
- [x] created_at
- [x] UNIQUE(site_id, month, voter_id)

### 10.5 VoteCandidate 테이블

- [x] id (PK)
- [x] site_id
- [x] month
- [x] user_id (FK)
- [x] source ('ADMIN', 'AUTO')
- [x] created_at

### 10.6 AccessPolicy 테이블

- [x] id (PK)
- [x] site_id
- [x] require_checkin (boolean)
- [x] day_cutoff_hour (0-23)

---

## 11. 보안 요구사항

### 11.1 데이터 보호

- [x] CryptoService 구현 (AES-256-GCM) ✅ NEW
- [x] HMAC 해시 인덱스 (검색용)
- [x] 전화번호/생년월일 실제 암호화 적용 ✅ (phoneEncrypted, dobEncrypted)
- [x] ~~암호화 키 관리 (KMS)~~ → N/A (CF Workers Secrets 사용 — 별도 KMS 불필요)

### 11.2 접근 제어

- [x] JWT 토큰 검증
- [x] API Rate Limiting ✅ NEW - ThrottlerGuard
- [x] CORS 설정 ✅ (index.ts cors middleware)
- [x] HTTPS 필수 (배포 환경)

### 11.3 감사 로그

- [x] 기존 AuditLog 테이블 존재
- [x] 로그인 시도 로그
- [x] 수동 승인 로그
- [x] 관리자 행동 로그

---

## 12. 운영 요구사항

### 12.1 모니터링

- [x] FAS 연동 상태 모니터링 ✅ NEW - GET /admin/sync-status
- [ ] API 응답 시간 모니터링
- [ ] 에러율 모니터링
- [ ] 알림 설정

### 12.2 장애 대응

- [ ] FAS 다운 시 처리 정책
- [ ] 장애 공지 UX
- [x] 수동 승인으로 우회 ✅ NEW

### 12.3 배포

- [x] Worker App → Cloudflare Pages
- [x] Admin App → Cloudflare Pages
- [x] API → Cloudflare Workers (Hono)
- [x] Database → Cloudflare D1 (SQLite/Drizzle)

---

## 13. 안전교육 시스템 (Safety Education) ✅ NEW

### 13.1 교육자료 (Education Content)

- [x] 교육자료 목록/상세 API (GET /education/contents)
- [x] 교육자료 등록/수정/삭제 API (Admin)
- [x] 교육자료 열람 UI (Worker App)
- [x] 교육자료 관리 UI (Admin App)

### 13.2 퀴즈/평가 (Quiz)

- [x] 퀴즈 목록/상세 API (GET /education/quizzes)
- [x] 퀴즈 등록/수정/삭제 + 문제 관리 API (Admin)
- [x] 퀴즈 응시 API (POST /education/quizzes/:id/attempt)
- [x] 퀴즈 응시 UI (Worker App)
- [x] 퀴즈 관리 UI (Admin App)

### 13.3 TBM (Toolbox Meeting)

- [x] TBM 기록/참석 API (GET/POST /education/tbm)
- [x] TBM 관리 UI (Admin App)

### 13.4 법정교육 (Statutory Training)

- [x] 법정교육 CRUD API (Admin)
- [x] 법정교육 관리 UI (Admin App)

---

## 진행 상태 요약

| 카테고리        | 총 항목 | 완료    | 진행률  |
| --------------- | ------- | ------- | ------- |
| 사용자 인증     | 15      | 14      | 93%     |
| FAS 연동        | 18      | 16      | 89%     |
| 접근 제어       | 12      | 11      | 92%     |
| 메인 화면       | 12      | 12      | 100%    |
| 우수근로자 투표 | 14      | 13      | 93%     |
| 포인트 시스템   | 8       | 8       | 100%    |
| 게시물          | 12      | 12      | 100%    |
| 관리자 기능     | 24      | 24      | 100%    |
| API             | 22      | 21      | 95%     |
| 데이터베이스    | 32      | 30      | 94%     |
| 보안            | 12      | 12      | 100%    |
| 운영            | 10      | 6       | 60%     |
| 안전교육        | 13      | 13      | 100%    |
| **합계**        | **204** | **194** | **95%** |

---

## 이번 세션 구현 완료 항목

### P0 (Critical) - 완료

- [x] Rate Limiting 구현 (5 req/min on login)
- [x] 미출근자 접근 제어 적용 (AttendanceGuard)
- [x] CryptoService 구현 (암호화 인프라)

### P1 (High) - 완료

- [x] 자정 재로그인 로직 (JWT Guard)
- [x] 로그인 시 출근 인증 체크 (AuthService)
- [x] 수동 출근 승인 API (POST /admin/manual-approval)
- [x] FAS 동기화 상태 API (GET /admin/sync-status)
- [x] FAS 근로자 동기화 API (POST /fas/workers/sync)

---

## 남은 우선순위 작업

### P0 (Critical - 보안)

- [x] 전화번호/생년월일 실제 암호화 저장 적용 ✅ (2026-02-04)
- [x] 로그인 시도 횟수 제한 (계정 잠금) ✅ (1.1 참조 - 이미 구현됨)

### P1 (High)

- [x] 해당 현장 출근 시에만 접속 허용 ✅ NEW - accessPolicies per-site + attendanceMiddleware 연동
- [x] 수동 승인 UI (Admin) ✅ (approvals 페이지 구현됨)

### P2 (Medium)

- [x] Idempotency (출근 동기화 중복 방지) ✅ - Idempotency-Key 헤더 + onConflictDoNothing
- [x] 감사 로그 강화 ✅ NEW - disputes status, FAS sync audit 추가
- [x] 미매칭 근로자 목록 ✅ - GET /attendance/unmatched 구현됨
