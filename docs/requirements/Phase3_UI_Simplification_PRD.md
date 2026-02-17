# Phase 3: 제보 카테고리 UI 간소화 + 우수근로자 추천 개편

> **Version**: v1.0  
> **Date**: 2026-02-17  
> **Status**: ✅ 구현 완료 / 배포 완료 (2026-02-17)  
> **Scope**: Worker App (PWA) + API Worker

---

## 목차

1. [변경 배경](#1-변경-배경)
2. [Part 1: 카테고리별 제보 항목 수정 (UI 간소화)](#2-part-1-카테고리별-제보-항목-수정)
3. [Part 2: 우수사례 → 우수근로자 추천 개편](#3-part-2-우수사례--우수근로자-추천-개편)
4. [현행 시스템 분석 (AS-IS)](#4-현행-시스템-분석-as-is)
5. [변경 사항 (TO-BE)](#5-변경-사항-to-be)
6. [구현 체크리스트](#6-구현-체크리스트)
7. [영향 범위 분석](#7-영향-범위-분석)

---

## 1. 변경 배경

현장 근로자 제보 작성 시 불필요한 상세 입력 필드가 있어 작성 부담이 크고, '우수사례(BEST_PRACTICE)' 카테고리가 별도 '우수근로자 추천' 시스템과 중복됨. UI를 간소화하고 기능을 명확히 분리하여 사용성을 개선함.

---

## 2. Part 1: 카테고리별 제보 항목 수정

### 2.1 요구사항 원문

| 카테고리                      | 삭제 항목                 |
| ----------------------------- | ------------------------- |
| 위험요인 (HAZARD)             | 위험요인 상세             |
| 불안전 행동 (UNSAFE_BEHAVIOR) | 불안전 행동 상세          |
| 불편사항 (INCONVENIENCE)      | 불편사항 상세, 위치(선택) |
| 개선제안 (SUGGESTION)         | 개선제안 상세             |

### 2.2 현행 분석 결과

**Worker App 제보 작성 폼** (`apps/worker-app/src/app/posts/new/page.tsx`):

현재 제보 작성 폼에는 카테고리별 "상세" 입력 필드가 **존재하지 않음**. 전 카테고리 공통으로 아래 필드만 사용:

| 필드          | 변수명          | 대상 카테고리             | DB 컬럼          |
| ------------- | --------------- | ------------------------- | ---------------- |
| 카테고리 선택 | `category`      | 전체                      | `category`       |
| 위험등급      | `riskLevel`     | HAZARD, UNSAFE_BEHAVIOR만 | `risk_level`     |
| 내용 (설명)   | `content`       | 전체                      | `content`        |
| 위치 (층)     | `locationFloor` | 전체                      | `location_floor` |
| 위치 (구역)   | `locationZone`  | 전체                      | `location_zone`  |
| 사진          | `files`         | 전체                      | R2 업로드        |
| 익명 여부     | `isAnonymous`   | 전체                      | `is_anonymous`   |

**DB 스키마에는 미사용 컬럼 존재**:

- `hazard_type` (위험요인 유형) — DB에 정의되어 있으나 폼에서 사용하지 않음
- `location_detail` (위치 상세) — DB에 정의되어 있으나 폼에서 사용하지 않음

### 2.3 결론 및 조치 방안

| 요구사항                 | 현행 상태                                                     | 필요 조치                                          |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| 위험요인 상세 삭제       | 폼에 해당 필드 없음                                           | **조치 불필요** (이미 간소화 완료)                 |
| 불안전 행동 상세 삭제    | 폼에 해당 필드 없음                                           | **조치 불필요** (이미 간소화 완료)                 |
| 불편사항 상세 삭제       | 폼에 해당 필드 없음                                           | **조치 불필요** (이미 간소화 완료)                 |
| 불편사항 위치(선택) 삭제 | `locationFloor`, `locationZone`이 전 카테고리 공통으로 표시됨 | **INCONVENIENCE 카테고리에서 위치 필드 숨김 처리** |
| 개선제안 상세 삭제       | 폼에 해당 필드 없음                                           | **조치 불필요** (이미 간소화 완료)                 |

**실제 코드 변경 필요 항목**: INCONVENIENCE 카테고리 선택 시 위치 입력 필드(층/구역) 숨김 처리 1건.

**DB 정리 (선택사항)**: `hazard_type`, `location_detail` 미사용 컬럼은 데이터 무결성 이유로 당장 삭제하지 않고, 향후 마이그레이션 시 정리.

---

## 3. Part 2: 우수사례 → 우수근로자 추천 개편

### 3.1 요구사항 원문

| 항목      | 내용                                         |
| --------- | -------------------------------------------- |
| 항목명    | 우수근로자 추천                              |
| 입력 필드 | 공종명(직접입력), 이름(직접입력), 추천 사유  |
| 참여 조건 | 당일 FAS(안면인식) 출근 인증 완료된 사용자만 |
| 횟수 제한 | 1일 1명                                      |

### 3.2 현행 분석 결과 — 이미 구현 완료

**우수근로자 추천 기능이 이미 존재함** (`/votes` 경로):

| 구성 요소          | 파일                                            | 상태          |
| ------------------ | ----------------------------------------------- | ------------- |
| **Worker App UI**  | `apps/worker-app/src/app/votes/page.tsx`        | **구현 완료** |
| **API 엔드포인트** | `apps/api-worker/src/routes/recommendations.ts` | **구현 완료** |
| **DB 테이블**      | `recommendations` (schema.ts:692-723)           | **구현 완료** |
| **API 훅**         | `apps/worker-app/src/hooks/use-api.ts:436-477`  | **구현 완료** |
| **Admin 관리**     | `apps/admin-app/src/app/votes/` (4파일)         | **구현 완료** |

**현재 구현된 입력 필드**:

| 필드      | UI 라벨           | API 필드명        | DB 컬럼            |
| --------- | ----------------- | ----------------- | ------------------ |
| 공종명    | 공종명 (직접입력) | `tradeType`       | `trade_type`       |
| 이름      | 이름 (직접입력)   | `recommendedName` | `recommended_name` |
| 추천 사유 | 추천 사유         | `reason`          | `reason`           |

-> **요구사항과 100% 일치**

**참여 조건 (FAS 출근 인증) 검증**:

```
recommendations.ts:48 → attendanceMiddleware(c, async () => {}, siteId)
```

`attendanceMiddleware` (`src/middleware/attendance.ts`)가 다음을 확인:

1. 현장 멤버십 확인 (ACTIVE 상태)
2. 환경변수 `REQUIRE_ATTENDANCE_FOR_POST` 체크
3. FAS 다운타임 시 graceful degradation (KV `fas-status` 확인)
4. **당일 `attendance` 테이블에서 `result=SUCCESS` 기록 확인**
5. 출근 기록 없으면 `manualApprovals` 테이블 대체 확인
6. 모두 없으면 **403 "해당 현장에 오늘 출근 기록이 없습니다"** 반환

-> **FAS 출근 인증 조건 이미 서버사이드에서 강제 적용 중** ✅

**1일 1명 제한 검증**:

```
recommendations.ts:72-91 → 동일 siteId + recommenderId + recommendationDate 조합 체크
→ 이미 존재하면 409 "오늘 이미 추천하셨습니다" 반환
```

DB 유니크 제약조건도 존재:

```
schema.ts:713-717 → unique().on(siteId, recommenderId, recommendationDate)
```

-> **1일 1명 제한 서버사이드 + DB 레벨 모두 강제 적용 중** ✅

### 3.3 BEST_PRACTICE 카테고리 정리

현재 `BEST_PRACTICE`는:

- **제보 작성 폼에 포함되지 않음** (이미 4개 카테고리만 표시)
- DB `categoryEnum`과 Types `Category` enum에만 존재
- `post-card.tsx`, `posts/view/page.tsx`, `announcements/page.tsx`에서 표시용으로만 참조

**조치 방안**:

- enum에서 즉시 삭제하면 기존 BEST_PRACTICE 게시물 데이터 불일치 발생 가능
- **권장**: UI에서 완전히 숨기되, enum/DB에는 유지 (하위 호환성). 신규 생성 차단만 유지.
- 현재 상태가 이미 이 방식이므로 **추가 조치 불필요**

---

## 4. 현행 시스템 분석 (AS-IS)

### 제보 작성 흐름

```
홈 → 제보하기 → 카테고리 선택(4개) → 내용 입력 → 위치(층/구역) → 사진 → 익명여부 → 제출
```

### 우수근로자 추천 흐름

```
홈 → 우수근로자 추천 → 공종명 입력 → 이름 입력 → 추천 사유 → 제출
                         ↑ FAS 출근 인증 필수 (서버 검증)
                         ↑ 1일 1명 제한 (서버 + DB 유니크 제약)
```

---

## 5. 변경 사항 (TO-BE)

### Part 1 변경 사항

| #   | 변경 내용                                              | 대상 파일                                    | 변경 유형        |
| --- | ------------------------------------------------------ | -------------------------------------------- | ---------------- |
| 1-1 | INCONVENIENCE 카테고리 선택 시 위치 필드(층/구역) 숨김 | `apps/worker-app/src/app/posts/new/page.tsx` | UI 조건부 렌더링 |

### Part 2 변경 사항

| #   | 변경 내용                      | 대상 파일 | 변경 유형 |
| --- | ------------------------------ | --------- | --------- |
| —   | 없음 (이미 모든 요구사항 충족) | —         | —         |

---

## 6. 구현 체크리스트

### Part 1: 카테고리별 제보 항목 수정

- [x] **1-1**: `posts/new/page.tsx`에서 `category === 'INCONVENIENCE'`일 때 `locationFloor`, `locationZone` 입력 필드 숨김 처리 ✅
- [x] **1-2**: INCONVENIENCE 제출 시 `locationFloor`, `locationZone` 값을 빈 문자열/null로 초기화 (카테고리 전환 시 잔류 값 방지) ✅
- [x] **1-3**: 기존 INCONVENIENCE 게시물 조회 시 위치 정보가 있으면 정상 표시 (하위 호환) ✅

### Part 2: 우수근로자 추천

- [x] ~~공종명(직접입력) 필드~~ — 이미 구현 (`tradeType`)
- [x] ~~이름(직접입력) 필드~~ — 이미 구현 (`recommendedName`)
- [x] ~~추천 사유 필드~~ — 이미 구현 (`reason`)
- [x] ~~FAS 출근 인증 조건~~ — `attendanceMiddleware` 적용 중
- [x] ~~1일 1명 제한~~ — 서버 로직 + DB 유니크 제약 적용 중
- [x] ~~클라이언트 UX (오늘 추천 여부 표시)~~ — `/recommendations/today` 체크 구현 중

### BEST_PRACTICE 정리 (선택사항)

- [ ] **선택**: `post-card.tsx`에서 BEST_PRACTICE 라벨/아이콘 표시 코드 정리 (dead code)
- [ ] **선택**: `posts/view/page.tsx`에서 BEST_PRACTICE 분기 정리
- [ ] **선택**: `announcements/page.tsx`에서 BEST_PRACTICE 참조 정리
- [ ] **비권장**: enum에서 BEST_PRACTICE 삭제 (기존 데이터 호환성 이슈)

### 배포 전 검증

- [x] `tsc --noEmit` 타입체크 통과 ✅
- [x] 제보 작성 폼에서 INCONVENIENCE 선택 시 위치 필드 미노출 확인 ✅
- [x] 제보 작성 폼에서 HAZARD/UNSAFE_BEHAVIOR/SUGGESTION 선택 시 위치 필드 정상 노출 확인 ✅
- [x] 우수근로자 추천 (`/votes`) 정상 동작 확인 ✅

---

## 7. 영향 범위 분석

### 변경 파일 목록 (최소)

| 파일                                         | 변경 내용                       | 위험도 |
| -------------------------------------------- | ------------------------------- | ------ |
| `apps/worker-app/src/app/posts/new/page.tsx` | INCONVENIENCE 시 위치 필드 숨김 | 낮음   |

### 변경 불필요 확인 파일

| 파일                                            | 사유                         |
| ----------------------------------------------- | ---------------------------- |
| `apps/api-worker/src/routes/recommendations.ts` | 요구사항 이미 충족           |
| `apps/api-worker/src/middleware/attendance.ts`  | FAS 인증 이미 적용           |
| `apps/api-worker/src/db/schema.ts`              | 스키마 변경 불필요           |
| `packages/types/src/enums.ts`                   | enum 변경 불필요 (하위 호환) |
| `apps/worker-app/src/app/votes/page.tsx`        | 추천 UI 이미 완성            |

---

## 요약

| 구분                  | 요구사항         | 현행 상태             | 필요 작업                |
| --------------------- | ---------------- | --------------------- | ------------------------ |
| 위험요인 상세 삭제    | 삭제             | 필드 없음             | **없음**                 |
| 불안전 행동 상세 삭제 | 삭제             | 필드 없음             | **없음**                 |
| 불편사항 상세 삭제    | 삭제             | 필드 없음             | **없음**                 |
| 불편사항 위치 삭제    | 삭제             | 전 카테고리 공통 표시 | **INCONVENIENCE만 숨김** |
| 개선제안 상세 삭제    | 삭제             | 필드 없음             | **없음**                 |
| 우수근로자 추천 필드  | 공종명/이름/사유 | 이미 구현             | **없음**                 |
| FAS 출근 인증         | 필수             | 서버 적용 중          | **없음**                 |
| 1일 1명 제한          | 필수             | 서버+DB 적용 중       | **없음**                 |
| BEST_PRACTICE 제거    | 암시             | UI에서 이미 미노출    | **없음** (enum 유지)     |

**실제 코드 변경: 1파일, 1건** — `posts/new/page.tsx`에서 INCONVENIENCE 선택 시 위치 필드 숨김.
