# 안전지갑 요구사항 리뷰 및 체크리스트

## 1. 요구사항 리뷰 (Issues)

### 🔴 High Priority Issues

#### [ISSUE-001] Authentication 강도 부족
- **Description**: `name + phone + DOB`는 비밀정보가 아님. 추측/도용 위험
- **Impact**: High
- **Recommendation**: rate limiting, lockout, device fingerprint, OTP/SMS 검토

#### [ISSUE-002] Identity 매칭 모호
- **Description**: `worker_code`가 전사 unique인지 site별 unique인지 불명
- **Impact**: High
- **Recommendation**: `(external_system, site_id, external_worker_id)` 복합키 사용

#### [ISSUE-003] PII 저장/검색 설계 갭
- **Description**: `encrypted phone/dob`만으로는 로그인 시 검색 불가
- **Impact**: High
- **Recommendation**: `phone_hash`, `dob_hash` (HMAC) 인덱스 추가

### 🟡 Medium Priority Issues

#### [ISSUE-004] Auto-create 트리거 불명확
- **Description**: worker master sync 시점 vs attendance event 수신 시점 불명
- **Impact**: Medium
- **Recommendation**: master sync 먼저, attendance는 master 존재 시에만 처리

#### [ISSUE-005] Attendance result 의미 불명확
- **Description**: `result`가 fail도 포함하면 "Valid" 조건에 fail 포함 여부 결정 필요
- **Impact**: Medium
- **Recommendation**: success만 valid로 처리 (명시적 정책)

#### [ISSUE-006] Day boundary/Timezone 모호
- **Description**: "00:00–23:59" vs "night shift 06:00 cutoff" 기준 불명
- **Impact**: Medium
- **Recommendation**: site별 `day_cutoff_hour` + timezone 설정

#### [ISSUE-007] Login gating 타이밍
- **Description**: 로그인 시 1회 검사 vs 세션 중 재검증 필요 여부 불명
- **Impact**: Medium
- **Recommendation**: JWT TTL 24시간, 자정 통과 시 재로그인 요구

#### [ISSUE-008] Multi-site 규칙 불완전
- **Description**: `Users.site_id` 단일 값이면 현장 이동/겸직 처리 불가
- **Impact**: Medium
- **Recommendation**: `UserSiteMembership` 테이블 또는 site 선택 UI

#### [ISSUE-009] Voting 규칙 모호
- **Description**: "checked-in만 투표" 기준 시점, 사이트/전사 범위 불명
- **Impact**: Medium
- **Recommendation**: 투표 시점 당일 출석, 사이트별 투표로 명시

### 🟢 Low Priority Issues

#### [ISSUE-010] Admin override 악용 가능
- **Description**: 장비 고장 시 override 필요하나 권한 통제/감사 필요
- **Impact**: Medium (Low likelihood)
- **Recommendation**: RBAC, 사유 필수, audit log

---

## 2. 기술 결정 필요 사항 (Technical Decisions Required)

| # | 결정 사항 | 옵션 | 권장 |
|---|----------|------|------|
| 1 | **FAS 연동 방식** | A) API/Webhook B) DB Polling C) CSV | A 우선, 불가시 B |
| 2 | **Identity Key** | worker_code 단독 vs worker_code+site_id | site_id 포함 권장 |
| 3 | **Login 보안 강화** | 현행유지 vs OTP/SMS 추가 | Phase 2에서 OTP 추가 |
| 4 | **PII 검색** | 평문 vs HMAC hash index | HMAC index 필수 |
| 5 | **출석 유효 조건** | 모든 로그 vs success만 | success만 |
| 6 | **Day Cutoff** | 00:00 고정 vs site별 설정 | site별 설정 |
| 7 | **세션 정책** | 무제한 vs TTL+자정 재검증 | 24h TTL + 자정 재검증 |
| 8 | **투표 범위** | 전사 vs site별 | site별 |
| 9 | **투표 자격** | 해당월 1회 출석 vs 투표 당일 출석 | 투표 당일 출석 |

---

## 3. 구현 체크리스트 (Implementation Checklist)

### Phase 0: 요구사항 확정 (1-2일)

- [ ] FAS 연동 방식 확정 (API/Polling/CSV)
- [ ] FAS에서 제공하는 필드 목록 확인
- [ ] `worker_code` uniqueness 범위 확인
- [ ] 출석 유효 조건 (success만) 확정
- [ ] Day cutoff 정책 (00:00 vs 06:00) 확정
- [ ] 투표 범위 (site별) 및 자격 (당일 출석) 확정
- [ ] Admin override 정책 확정

### Phase 1: 데이터 모델 변경 (2-3일)

- [ ] Users 테이블 변경
  - [ ] `external_system` 필드 추가 (enum: 'FAS')
  - [ ] `external_worker_id` 필드 추가 (FAS worker_code)
  - [ ] `phone_hash` 필드 추가 (HMAC index용)
  - [ ] `dob_hash` 필드 추가 (HMAC index용)
  - [ ] `phone_encrypted` 필드 (기존 phone 대체)
  - [ ] `dob_encrypted` 필드 추가
  - [ ] `company_name` 필드 추가
  - [ ] `trade_type` 필드 추가
- [ ] Attendance 테이블 생성
  - [ ] `id`, `site_id`, `external_worker_id`
  - [ ] `checkin_at` (timestamp)
  - [ ] `result` (enum: success/fail)
  - [ ] `device_id` (nullable)
  - [ ] `source` (enum: 'FAS', 'MANUAL')
  - [ ] Unique constraint: `(site_id, external_worker_id, checkin_at)`
- [ ] AccessPolicy 테이블 생성
  - [ ] `site_id`, `require_checkin`, `day_cutoff_hour`
- [ ] ManualApproval 테이블 생성 (admin override용)
  - [ ] `user_id`, `approved_by`, `reason`, `approved_at`, `valid_date`
- [ ] Migration 스크립트 작성 및 테스트

### Phase 2: FAS 연동 서비스 (3-5일)

- [ ] FAS 연동 모듈 구조 설계
  - [ ] `FasIntegrationService` (추상 인터페이스)
  - [ ] `FasApiAdapter` / `FasPollingAdapter` / `FasCsvAdapter`
- [ ] Worker Master 동기화
  - [ ] 신규 등록 시 SW 사용자 자동 생성
  - [ ] 정보 변경 시 업데이트
  - [ ] 삭제/비활성화 시 soft-delete
  - [ ] 동기화 상태 로깅
- [ ] Attendance Event 동기화
  - [ ] 출석 이벤트 수신/저장
  - [ ] Idempotency 처리 (중복 방지)
  - [ ] Watermark 기반 polling (B안 선택 시)
  - [ ] 수신 상태 모니터링
- [ ] 동기화 스케줄러 (cron job)
- [ ] 에러 핸들링 및 재처리 로직

### Phase 3: 인증/인가 변경 (3-4일)

- [ ] 기존 인증 코드 제거
  - [ ] QR 체크인 기능 제거
  - [ ] 회원가입 API/UI 제거
  - [ ] 기존 로그인 로직 제거
- [ ] 신규 로그인 구현
  - [ ] LoginDto: name, phone, dob
  - [ ] 입력 정규화 (phone: 숫자만, dob: YYYYMMDD)
  - [ ] HMAC hash로 사용자 조회
  - [ ] 오늘 출석 로그 확인
  - [ ] JWT 발급 (24h TTL)
- [ ] 로그인 실패 처리
  - [ ] 미등록: "등록된 근로자 정보가 없습니다"
  - [ ] 미출석: "오늘 출근 인증이 확인되지 않습니다"
  - [ ] 정보 불일치: "입력 정보가 일치하지 않습니다"
- [ ] Rate limiting (IP/계정 기반)
- [ ] 세션 미들웨어
  - [ ] 자정 통과 시 재검증
  - [ ] 출석 상태 변경 시 처리

### Phase 4: 프론트엔드 UI 변경 (2-3일)

- [ ] 로그인 화면 변경
  - [ ] 이름 입력 필드
  - [ ] 전화번호 입력 필드
  - [ ] 생년월일 입력 필드 (YYYYMMDD)
  - [ ] 회원가입 버튼 삭제
  - [ ] QR 체크인 버튼 삭제
  - [ ] 에러 메시지 표시
- [ ] 메인 화면 변경
  - [ ] 출근 인증 상태 표시 (읽기 전용)
  - [ ] 포인트 현황
  - [ ] 안전 행동요령
  - [ ] 안전 제안/신고
  - [ ] 우수근로자 투표 (조건부)
- [ ] 접근 제어 적용
  - [ ] 미출석 시 기능 비활성화
  - [ ] 안내 메시지 표시

### Phase 5: 우수근로자 투표 (3-4일)

- [ ] 투표 데이터 모델
  - [ ] Vote 테이블: `id`, `site_id`, `month`, `voter_id`, `candidate_id`, `voted_at`
  - [ ] VoteCandidate 테이블: `id`, `site_id`, `month`, `user_id`, `source` (admin/auto)
  - [ ] Unique constraint: `(site_id, month, voter_id)`
- [ ] 투표 API
  - [ ] `GET /votes/candidates` - 후보 목록 조회
  - [ ] `POST /votes` - 투표
  - [ ] `GET /votes/results` - 결과 조회 (권한별)
- [ ] 투표 자격 검증
  - [ ] 당일 출석 확인
  - [ ] 중복 투표 방지
- [ ] 후보 관리
  - [ ] 관리자 등록 방식
  - [ ] 포인트 상위 N명 자동 선정 (옵션)
- [ ] 결과 노출
  - [ ] 관리자: 실명/전체 결과
  - [ ] 근로자: 상위 3명 마스킹

### Phase 6: 관리자 기능 (2-3일)

- [ ] 동기화 상태 대시보드
  - [ ] FAS 등록자 수 vs SW 생성 계정 수
  - [ ] 미매칭 수/목록
  - [ ] 최근 동기화 시간
  - [ ] 에러 건수/내역
- [ ] 출근 로그 모니터링
  - [ ] 검색: 날짜/사이트/worker_code/result
  - [ ] 오늘 로그 건수
  - [ ] 이상치 탐지 (옵션)
- [ ] 수동 출근 승인
  - [ ] 승인 사유 필수
  - [ ] 승인자/시간 로그
  - [ ] 승인 취소 기능

### Phase 7: 보안 및 운영 (2-3일)

- [ ] Key Management
  - [ ] HMAC 키 관리 (환경변수 또는 KMS)
  - [ ] 암호화 키 로테이션 계획
- [ ] PII 접근 로깅
- [ ] 데이터 보관 정책 (retention)
- [ ] 장애 대응
  - [ ] FAS 다운 시 admin override만 허용
  - [ ] 장애 공지 UX
- [ ] 모니터링/알림 설정

### Phase 8: 테스트 및 배포 (2-3일)

- [ ] 테스트 시나리오 수행
  - [ ] FAS 신규 등록 → SW 자동 생성
  - [ ] 출근 전 로그인 → 차단
  - [ ] 게이트 출근 → 1~5분 내 로그인 성공
  - [ ] 출근 후 게시물/투표 가능
  - [ ] 동명이인 → external_worker_id로 구분
- [ ] 통합 테스트
- [ ] Pilot site 적용
- [ ] 데이터 정합성 리포트
- [ ] 전체 배포

---

## 4. 리스크 매트릭스 (Risk Matrix)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 약한 로그인으로 계정 도용 | High | High | rate limiting, lockout, OTP 검토 |
| 동일 phone/DOB/이름 오인매칭 | Medium | High | external_worker_id 중심, site scope |
| FAS 연동 지연/다운 | Medium | High | lag 모니터링, admin override, 장애 UX |
| Polling/CSV 누락/중복 | Medium | Medium | watermark+dedupe, 정합성 리포트 |
| Day boundary 오적용 | Medium | Medium | site별 설정, 테스트 케이스 |
| Admin override 남용 | Low | High | RBAC, audit log, 사유 필수 |
| PII 유출 | Low | High | encryption, HMAC, 접근 통제 |
| Voting 조작/강요 | Medium | Medium | 익명성, 마스킹, audit log |
| Multi-site 이동 혼선 | Medium | Medium | site 선택 UX, 정책 안내 |

---

## 5. 예상 일정

| Phase | 기간 | 누적 |
|-------|------|------|
| Phase 0: 요구사항 확정 | 1-2일 | 2일 |
| Phase 1: 데이터 모델 | 2-3일 | 5일 |
| Phase 2: FAS 연동 | 3-5일 | 10일 |
| Phase 3: 인증/인가 | 3-4일 | 14일 |
| Phase 4: UI 변경 | 2-3일 | 17일 |
| Phase 5: 투표 기능 | 3-4일 | 21일 |
| Phase 6: 관리자 기능 | 2-3일 | 24일 |
| Phase 7: 보안/운영 | 2-3일 | 27일 |
| Phase 8: 테스트/배포 | 2-3일 | **30일 (6주)** |

---

## 6. 다음 단계 (Action Items)

### 즉시 필요한 결정사항

1. **FAS 연동 방식 확인**
   - [ ] FAS API 문서 확보
   - [ ] DB 접근 가능 여부 확인
   - [ ] CSV Export 가능 여부 확인

2. **FAS 데이터 필드 확인**
   - [ ] 출근 로그 화면의 컬럼 목록
   - [ ] 근로자 마스터의 필드 목록
   - [ ] `worker_code` uniqueness 범위

3. **정책 결정**
   - [ ] 출석 유효 조건 (success만 vs 모든 로그)
   - [ ] Day cutoff (00:00 vs 06:00)
   - [ ] 투표 자격 (당일 출석 vs 월내 출석)
