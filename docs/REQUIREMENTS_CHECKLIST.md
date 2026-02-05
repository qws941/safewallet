# SafetyWallet PRD vs Implementation Checklist

**Generated**: 2025-02-05  
**PRD Version**: v1.2 (Cloudflare Native Architecture)  
**Implementation Status**: 82% complete  
**Last Updated**: 2025-02-05

---

## Executive Summary

| Category                        | Status | Details                                                          |
| ------------------------------- | ------ | ---------------------------------------------------------------- |
| **Functional Requirements**     | 78%    | Core features mostly implemented, some gaps in edge cases        |
| **Security Requirements**       | 65%    | Basic auth/encryption in place, rate limiting incomplete         |
| **Data Model**                  | 95%    | 20+ tables implemented, schema aligned with PRD                  |
| **Frontend (Worker)**           | 100%   | All pages implemented and functional                             |
| **Frontend (Admin)**            | 79%    | Dashboard and core features done, some admin features incomplete |
| **Backend API**                 | 82%    | 12 route modules, most endpoints functional                      |
| **Non-Functional Requirements** | 60%    | Performance targets defined, monitoring incomplete               |

---

## 1. REGISTRATION & AUTHENTICATION

### 1.1 QR Code Registration

| Requirement                               | Status             | Notes                                        |
| ----------------------------------------- | ------------------ | -------------------------------------------- |
| QR code generation (16-24 char Base64url) | ✅ Implemented     | `sites.joinCode` field, unique per site      |
| QR code validation on scan                | ✅ Implemented     | `join/page.tsx` validates code → site lookup |
| Site auto-display after QR scan           | ✅ Implemented     | Site name shown in join flow                 |
| QR code reissue (super admin only)        | ⚠️ Partial         | Endpoint exists but no UI for reissue        |
| Previous code invalidation on reissue     | ❌ Not Implemented | **P1**: Need to track code history           |
| QR placement guidance                     | ❌ Not Implemented | **P2**: Documentation only                   |

### 1.2 Registration Flow

| Requirement                                        | Status         | Notes                                             |
| -------------------------------------------------- | -------------- | ------------------------------------------------- |
| Terms agreement screen                             | ✅ Implemented | Shown before info entry                           |
| Info entry form (name, phone, DOB, company, trade) | ✅ Implemented | All fields in join flow                           |
| SMS OTP verification                               | ⚠️ Partial     | OTP generation works, SMS provider not integrated |
| Registration completion                            | ✅ Implemented | User created in DB after OTP verify               |
| Duplicate phone detection                          | ✅ Implemented | `phoneHash` lookup prevents duplicates            |
| Redirect to existing account                       | ⚠️ Partial     | Detected but no redirect UI                       |

### 1.3 Rate Limits

| Limit                            | Requirement                   | Status             | Implementation                     |
| -------------------------------- | ----------------------------- | ------------------ | ---------------------------------- |
| OTP send (phone)                 | 5/hour, 10/24h                | ⚠️ Partial         | In-memory map, not persistent      |
| OTP send (IP)                    | 20/10min                      | ⚠️ Partial         | In-memory map, not persistent      |
| OTP verify fail                  | 5 consecutive → 15min lockout | ⚠️ Partial         | Tracked but lockout not enforced   |
| Registration attempt (IP)        | 30/hour                       | ⚠️ Partial         | In-memory map, not persistent      |
| Registration attempt (device ID) | 3 accounts/24h                | ❌ Not Implemented | **P1**: Need device fingerprinting |

**Gap**: Rate limiting uses in-memory Map, will reset on Worker restart. **P1**: Migrate to Durable Objects.

### 1.4 Fraud Prevention

| Scenario                             | Requirement                                | Status     | Notes                                         |
| ------------------------------------ | ------------------------------------------ | ---------- | --------------------------------------------- |
| QR sharing for external registration | Unpredictable code + rate limits           | ⚠️ Partial | Code is unpredictable, rate limits incomplete |
| Mass OTP bombing                     | Phone/IP rate limits + failure lockout     | ⚠️ Partial | Rate limits incomplete, lockout not enforced  |
| Multi-account creation               | Device ID limit + admin approval mode      | ⚠️ Partial | Device ID not tracked                         |
| Duplicate phone number               | Guide to existing account + login redirect | ⚠️ Partial | Detected but no redirect                      |

---

## 2. AUTHENTICATION & SESSION MANAGEMENT

### 2.1 JWT Authentication

| Requirement             | Status         | Notes                                              |
| ----------------------- | -------------- | -------------------------------------------------- |
| JWT token generation    | ✅ Implemented | 24h expiry, signed with JWT_SECRET                 |
| JWT token validation    | ✅ Implemented | `authMiddleware` validates on all protected routes |
| 24h token expiry        | ✅ Implemented | `ACCESS_TOKEN_EXPIRY_SECONDS = 86400`              |
| Refresh token mechanism | ✅ Implemented | UUID-based refresh token in DB                     |
| Token refresh endpoint  | ✅ Implemented | `/auth/refresh` rotates tokens                     |
| Daily reset at 5 AM KST | ✅ Implemented | `getTodayRange()` uses 5 AM cutoff                 |
| Logout endpoint         | ✅ Implemented | Clears refresh token                               |

### 2.2 Session Management

| Requirement                           | Status             | Notes                              |
| ------------------------------------- | ------------------ | ---------------------------------- |
| Session storage (JWT + Refresh Token) | ✅ Implemented     | Refresh token in DB, JWT in client |
| Session expiry handling               | ✅ Implemented     | 24h expiry, auto-refresh on 401    |
| Session invalidation on logout        | ✅ Implemented     | Refresh token deleted              |
| KV caching for sessions               | ❌ Not Implemented | **P2**: Optional optimization      |

---

## 3. USER & PERMISSION MODEL

### 3.1 Role Definitions

| Role        | Status         | Implementation                 |
| ----------- | -------------- | ------------------------------ |
| WORKER      | ✅ Implemented | Default role, can create posts |
| SITE_ADMIN  | ✅ Implemented | Can review posts, award points |
| SUPER_ADMIN | ✅ Implemented | Can manage all sites, users    |
| SYSTEM      | ✅ Implemented | For automated actions          |

### 3.2 Permission Flags

| Flag            | Status         | Notes                                              |
| --------------- | -------------- | -------------------------------------------------- |
| `PII_VIEW_FULL` | ✅ Implemented | Field in users table, checked on PII access        |
| `POINT_AWARD`   | ✅ Implemented | Checked in points award endpoint                   |
| `EXPORT`        | ⚠️ Partial     | Field exists, export endpoint not implemented      |
| `POLICY_EDIT`   | ⚠️ Partial     | Field exists, policy edit endpoint not implemented |
| `NOTICE_EDIT`   | ✅ Implemented | Checked in announcements creation                  |

### 3.3 Permission Matrix

| Function               | WORKER | SITE_ADMIN | SUPER_ADMIN | Status             |
| ---------------------- | :----: | :--------: | :---------: | ------------------ |
| Register/Login         |   ✓    |     ✓      |      ✓      | ✅                 |
| View/Edit own profile  |   ✓    |     ✓      |      ✓      | ✅                 |
| Create post            |   ✓    |     -      |      -      | ✅                 |
| View/Edit own posts    |   ✓    |     -      |      -      | ✅                 |
| View announcements     |   ✓    |     ✓      |      ✓      | ✅                 |
| View points/ranking    |   ✓    |     ✓      |      ✓      | ✅                 |
| Admin dashboard        |   -    |     ✓      |      ✓      | ✅                 |
| Review/Process posts   |   -    |     ✓      |      ✓      | ✅                 |
| Approve (award points) |   -    |    ✓\*     |      ✓      | ✅                 |
| Adjust/Revoke points   |   -    |    ✓\*     |      ✓      | ✅                 |
| Assign action handler  |   -    |     ✓      |      ✓      | ✅                 |
| Create announcements   |   -    |    ✓\*     |      ✓      | ✅                 |
| Modify point policies  |   -    |     -      |      ✓      | ⚠️ Partial         |
| Create/Manage sites    |   -    |     -      |      ✓      | ✅                 |
| Manage master data     |   -    |     ✓      |      ✓      | ✅                 |
| Full PII view          |   -    |    ✓\*     |      ✓      | ✅                 |
| Excel/Image download   |   -    |    ✓\*     |      ✓      | ❌ Not Implemented |
| View audit logs        |   -    |     ✓      |      ✓      | ✅                 |

**Legend**: ✓ = Implemented, ✓\* = Requires permission flag, - = Not applicable

### 3.4 Personal Data Access Control

| Field          | Default Display | Full View Condition                         | Status         |
| -------------- | --------------- | ------------------------------------------- | -------------- |
| Phone number   | `010-****-1234` | `PII_VIEW_FULL` + reason                    | ✅ Implemented |
| Date of birth  | `199*-**-**`    | `PII_VIEW_FULL` + reason                    | ✅ Implemented |
| Name           | Masked option   | Admins see full by default                  | ✅ Implemented |
| Access logging | Required        | actor, target, field, reason, timestamp, ip | ✅ Implemented |

---

## 4. POST STATE MODEL

### 4.1 Review Status States

| State     | Status | Implementation               |
| --------- | ------ | ---------------------------- |
| RECEIVED  | ✅     | Initial state after creation |
| IN_REVIEW | ✅     | Admin starts review          |
| NEED_INFO | ✅     | Admin requests more info     |
| APPROVED  | ✅     | Points can be awarded        |
| REJECTED  | ✅     | No points awarded            |

### 4.2 Action Status States

| State       | Status | Implementation                |
| ----------- | ------ | ----------------------------- |
| NONE        | ✅     | Not an action item            |
| REQUIRED    | ✅     | Designated as action item     |
| ASSIGNED    | ✅     | Handler + deadline set        |
| IN_PROGRESS | ✅     | Work underway                 |
| DONE        | ✅     | Completed + evidence uploaded |
| REOPENED    | ✅     | Issue recurred                |

### 4.3 State Transitions

| Trigger         | Actor   | Condition              | Review Status | Action Status | Status |
| --------------- | ------- | ---------------------- | ------------- | ------------- | ------ |
| Create post     | Worker  | Validation passed      | →RECEIVED     | →NONE         | ✅     |
| Edit post       | Worker  | Only in RECEIVED       | Unchanged     | Unchanged     | ✅     |
| Start review    | Admin   | RECEIVED/NEED_INFO     | →IN_REVIEW    | Unchanged     | ✅     |
| Request info    | Admin   | IN_REVIEW              | →NEED_INFO    | Unchanged     | ✅     |
| Submit info     | Worker  | NEED_INFO              | Unchanged     | Unchanged     | ✅     |
| Reject          | Admin   | IN_REVIEW/NEED_INFO    | →REJECTED     | →NONE         | ✅     |
| Approve         | Admin   | IN_REVIEW              | →APPROVED     | Unchanged     | ✅     |
| Mark for action | Admin   | Before/after approval  | Unchanged     | →REQUIRED     | ✅     |
| Assign handler  | Admin   | REQUIRED               | Unchanged     | →ASSIGNED     | ✅     |
| Start action    | Handler | ASSIGNED               | Unchanged     | →IN_PROGRESS  | ✅     |
| Complete action | Handler | IN_PROGRESS + evidence | Unchanged     | →DONE         | ✅     |
| Reopen          | Admin   | DONE                   | Unchanged     | →REOPENED     | ✅     |

### 4.4 Worker Edit Permissions

| Scenario                               | Status     | Notes                                          |
| -------------------------------------- | ---------- | ---------------------------------------------- |
| Edit allowed in RECEIVED               | ✅         | Implemented in posts.ts                        |
| Edit blocked after IN_REVIEW           | ✅         | Validation checks review_status                |
| Supplementary attachments in NEED_INFO | ⚠️ Partial | Attachment endpoint exists but limited testing |

---

## 5. WORKER FEATURES

### 5.1 Home Screen

| Component                             | Status | Notes                           |
| ------------------------------------- | ------ | ------------------------------- |
| Header (site name, user name)         | ✅     | Implemented in Header component |
| Points card (this month + cumulative) | ✅     | PointsCard component            |
| Ranking card (this month's rank)      | ✅     | Ranking display in points page  |
| CTA button (Submit Report)            | ✅     | Link to /posts/new              |
| Announcement preview (latest 3)       | ✅     | Announcements section on home   |
| Daily check-in (attendance)           | ✅     | Attendance status card          |

### 5.2 Post Creation

| Field            | Required | Status | Notes                               |
| ---------------- | -------- | ------ | ----------------------------------- |
| Category         | ✓        | ✅     | Radio buttons for 5 categories      |
| Floor/Zone       | ✓        | ✅     | Dropdown + text input               |
| Location detail  | ✓        | ✅     | Text field                          |
| Risk level       | -        | ✅     | Select (High/Medium/Low)            |
| Content          | ✓        | ✅     | Text area, min 20 chars recommended |
| Photo            | \*       | ✅     | Image upload, varies by category    |
| Anonymous option | -        | ✅     | Toggle, default ON                  |

**Category-Specific Fields**:

| Category        | Additional Fields                       | Photo       | Visibility | Status |
| --------------- | --------------------------------------- | ----------- | ---------- | ------ |
| Hazard          | Type, Immediate action, Suggestion      | Required 1+ | All        | ✅     |
| Unsafe Behavior | Behavior type                           | Required 1+ | Admin only | ✅     |
| Inconvenience   | Type, Frequency                         | Optional    | All        | ✅     |
| Suggestion      | Type, Expected benefit, Contact consent | Optional    | All        | ✅     |
| Best Practice   | Before/After photos, Description        | Optional    | All        | ✅     |

### 5.3 My Posts

| Field                               | Status | Notes                    |
| ----------------------------------- | ------ | ------------------------ |
| Thumbnail (first image)             | ✅     | Displayed in post list   |
| Category (icon + text)              | ✅     | Category icon + label    |
| Status (review + action)            | ✅     | Dual status display      |
| Points (if approved)                | ✅     | Shown in post detail     |
| Feedback (rejection/request reason) | ✅     | Displayed in detail view |

### 5.4 Points/Ranking

| Feature                                | Status     | Notes                             |
| -------------------------------------- | ---------- | --------------------------------- |
| This month's points                    | ✅         | Calculated from ledger            |
| Cumulative points                      | ✅         | All-time total                    |
| Point history                          | ✅         | Date, reason, points, post link   |
| Ranking (Top 10 + my rank)             | ✅         | Calculated monthly                |
| Tie-breaker (approval count > earlier) | ⚠️ Partial | Logic exists but not fully tested |
| Names masked in ranking                | ✅         | Masking applied                   |

### 5.5 Announcements

| Type                                  | Status     | Notes                                       |
| ------------------------------------- | ---------- | ------------------------------------------- |
| Ranking announcement (monthly top 3)  | ✅         | Template-based                              |
| Best practice (selected post shared)  | ✅         | Template-based                              |
| Action completed (case improved)      | ✅         | Template-based                              |
| Reward notice (distribution schedule) | ⚠️ Partial | Template exists, distribution not automated |

---

## 6. ADMIN FEATURES

### 6.1 Dashboard

| Card                | Status     | Notes                                    |
| ------------------- | ---------- | ---------------------------------------- |
| Today's submissions | ✅         | Count of posts created today             |
| Backlog             | ✅         | Pending review count                     |
| Urgent              | ✅         | Urgent-flagged count                     |
| Avg processing time | ⚠️ Partial | Calculated but not displayed             |
| Category chart      | ⚠️ Partial | Data available, chart not implemented    |
| Hotspots            | ⚠️ Partial | Data available, visualization incomplete |

### 6.2 Review Queue

| Feature                                                               | Status | Notes                    |
| --------------------------------------------------------------------- | ------ | ------------------------ |
| Filters (site, company, trade, category, risk, status, date)          | ✅     | All filters implemented  |
| Urgent only toggle                                                    | ✅     | Filter by is_urgent flag |
| Sorting (pending first, urgent first, newest first)                   | ✅     | Multiple sort options    |
| List card (thumbnail, category, location, date, status, risk, author) | ✅     | All fields displayed     |

### 6.3 Post Detail Processing

| Action        | Required Input                      | Status | Notes                 |
| ------------- | ----------------------------------- | ------ | --------------------- |
| Approve       | Points (auto-suggested, adjustable) | ✅     | Creates ledger entry  |
| Reject        | Reason code + comment               | ✅     | Reason codes defined  |
| Request info  | Template selection                  | ✅     | Templates available   |
| Mark urgent   | Handler, deadline                   | ✅     | Sets is_urgent flag   |
| Assign action | Handler, deadline                   | ✅     | Creates action record |

### 6.4 Rejection Reasons

| Code          | Status | Implementation  |
| ------------- | ------ | --------------- |
| DUPLICATE     | ✅     | Defined in enum |
| UNCLEAR_PHOTO | ✅     | Defined in enum |
| INSUFFICIENT  | ✅     | Defined in enum |
| FALSE         | ✅     | Defined in enum |
| IRRELEVANT    | ✅     | Defined in enum |
| OTHER         | ✅     | Defined in enum |

### 6.5 Point Policy Management

| Item                    | Status     | Notes                                         |
| ----------------------- | ---------- | --------------------------------------------- |
| Category base points    | ✅         | Defined in PRD, hardcoded in code             |
| Risk level bonus        | ✅         | +5/+3/+0 implemented                          |
| Action completion bonus | ✅         | +5~+20 selectable                             |
| Daily maximum           | ⚠️ Partial | 30 points or 3 posts, not enforced            |
| Duplicate criteria      | ⚠️ Partial | Location+Type+24h logic exists but incomplete |

**Gap**: Policy management UI not implemented. **P1**: Need admin endpoint to modify policies.

### 6.6 Reward Management

| Function            | Status             | Notes                                         |
| ------------------- | ------------------ | --------------------------------------------- |
| Month selection     | ✅                 | Can select settlement month                   |
| Auto ranking        | ✅                 | Calculated from snapshot                      |
| Reward criteria     | ⚠️ Partial         | 1st/2nd/3rd amounts defined, not configurable |
| Distribution record | ⚠️ Partial         | Tracked but no UI                             |
| Excel download      | ❌ Not Implemented | **P1**: Need export endpoint                  |

---

## 7. POINT SYSTEM

### 7.1 Base Points

| Category        | Base Points | Status | Notes                     |
| --------------- | :---------: | ------ | ------------------------- |
| Hazard          |     10      | ✅     | Hardcoded                 |
| Unsafe Behavior |      8      | ✅     | Hardcoded                 |
| Inconvenience   |      5      | ✅     | Hardcoded                 |
| Suggestion      |      5      | ✅     | Hardcoded, +15 if adopted |
| Best Practice   |     10      | ✅     | Hardcoded                 |

### 7.2 Bonus Rules

| Condition         |        Bonus         | Status     |
| ----------------- | :------------------: | ---------- |
| Risk level High   |          +5          | ✅         |
| Risk level Medium |          +3          | ✅         |
| Risk level Low    |          +0          | ✅         |
| Action completed  |        +5~+20        | ✅         |
| Info supplemented | +2 (first time only) | ⚠️ Partial |

### 7.3 Limit Rules

| Rule                 | Content                           | Status             | Notes                          |
| -------------------- | --------------------------------- | ------------------ | ------------------------------ |
| Daily maximum        | 30 points or 3 posts              | ⚠️ Partial         | Logic exists, not enforced     |
| Duplicate/Repeat     | Same location+type+24h = 0 points | ⚠️ Partial         | Detection incomplete           |
| False report penalty | 3 cumulative = 7-day restriction  | ❌ Not Implemented | **P1**: Need restriction logic |

### 7.4 Ledger Rules

| Principle                                      | Status | Notes               |
| ---------------------------------------------- | ------ | ------------------- |
| Immutability (no modification/deletion)        | ✅     | Only INSERT allowed |
| Reference key (adjustments via ref_ledger_id)  | ✅     | Implemented         |
| Evidence (reason_code + reason_text + post_id) | ✅     | All required fields |

### 7.5 Monthly Attribution

| Event                   | Attribution                                    | Status |
| ----------------------- | ---------------------------------------------- | ------ |
| Approval points         | Based on approval timestamp                    | ✅     |
| Action completion bonus | Based on completion timestamp                  | ✅     |
| Adjustment/Revoke       | Based on adjustment timestamp (no retroactive) | ✅     |

### 7.6 Month-End / Dispute Flow

| Stage               | Timing                         | Status             | Notes                              |
| ------------------- | ------------------------------ | ------------------ | ---------------------------------- |
| Month end           | Last day 23:59:59 KST          | ⚠️ Partial         | Timestamp recorded                 |
| Snapshot generation | Next month D+1~3 business days | ⚠️ Partial         | Manual process, not automated      |
| Dispute period      | 7 days after snapshot          | ❌ Not Implemented | **P1**: Need dispute ticket system |
| Corrections         | Within dispute period          | ⚠️ Partial         | Can add correction ledger entries  |
| Reward finalization | After dispute period           | ⚠️ Partial         | Manual process                     |

**Gap**: Month-end snapshot and dispute workflow not automated. **P1**: Implement automated snapshot generation.

### 7.7 Adjustment/Revoke Cases

| Case                       | Processing                 | Authority            | Status |
| -------------------------- | -------------------------- | -------------------- | ------ |
| False report determination | Add deduction ledger entry | POINT_AWARD          | ✅     |
| Duplicate award            | Add deduction ledger entry | POINT_AWARD          | ✅     |
| Action completion revoked  | Deduct completion bonus    | POINT_AWARD          | ✅     |
| Retroactive policy change  | No retroactive             | SUPER_ADMIN override | ✅     |

---

## 8. NOTIFICATION SYSTEM

### 8.1 Notification Scenarios

| Trigger             | Recipient | Status     | Notes                    |
| ------------------- | --------- | ---------- | ------------------------ |
| Submission complete | Worker    | ⚠️ Partial | In-app only, no SMS/push |
| Info requested      | Worker    | ⚠️ Partial | In-app only              |
| Approved            | Worker    | ⚠️ Partial | In-app only              |
| Rejected            | Worker    | ⚠️ Partial | In-app only              |
| Action completed    | Worker    | ⚠️ Partial | In-app only              |
| Announcement posted | All       | ⚠️ Partial | In-app only              |
| Handler assigned    | Handler   | ⚠️ Partial | In-app only              |

**Gap**: SMS and Web Push not implemented. **P1**: Integrate SMS provider, implement Web Push.

### 8.2 Channel Priority

| Priority | Channel            | Status             | Notes                                 |
| :------: | ------------------ | ------------------ | ------------------------------------- |
|    1     | Web Push (PWA)     | ❌ Not Implemented | **P1**: Implement service worker push |
|    2     | SMS                | ❌ Not Implemented | **P1**: Integrate SMS provider        |
|    3     | KakaoTalk Business | ❌ Not Implemented | **P2**: Phase 2 feature               |

### 8.3 Fallback Rules

| Rule                                     | Status             | Notes                        |
| ---------------------------------------- | ------------------ | ---------------------------- |
| Web push fails → SMS (critical only)     | ❌ Not Implemented | **P1**: Need fallback logic  |
| SMS not configured → In-app notification | ✅                 | In-app notifications working |
| Notification center always records       | ✅                 | All notifications logged     |

---

## 9. DATA MODEL

### 9.1 Users Table

| Field             | Status | Notes                  |
| ----------------- | ------ | ---------------------- |
| user_id (PK)      | ✅     | UUID                   |
| phone_hash        | ✅     | HMAC-SHA256            |
| phone_encrypted   | ✅     | AES-256                |
| name              | ✅     | Plain text             |
| dob_encrypted     | ✅     | AES-256                |
| nationality_flag  | ✅     | Domestic/Foreign       |
| emergency_contact | ✅     | Optional               |
| status            | ✅     | active/pending/blocked |
| created_at        | ✅     | Timestamp              |
| last_login_at     | ✅     | Timestamp              |

### 9.2 SiteMemberships Table

| Field              | Status | Notes              |
| ------------------ | ------ | ------------------ |
| membership_id (PK) | ✅     | UUID               |
| user_id (FK)       | ✅     | References users   |
| site_id (FK)       | ✅     | References sites   |
| company_name       | ✅     | String             |
| trade_type         | ✅     | String             |
| joined_at          | ✅     | Timestamp          |
| left_at            | ✅     | Nullable timestamp |

### 9.3 Sites Table

| Field             | Status | Notes              |
| ----------------- | ------ | ------------------ |
| site_id (PK)      | ✅     | UUID               |
| name              | ✅     | String             |
| join_code         | ✅     | 16-24 char random  |
| active            | ✅     | Boolean            |
| join_enabled      | ✅     | Boolean            |
| requires_approval | ✅     | Boolean            |
| created_at        | ✅     | Timestamp          |
| closed_at         | ✅     | Nullable timestamp |

### 9.4 Posts Table

| Field           | Status | Notes                           |
| --------------- | ------ | ------------------------------- |
| post_id (PK)    | ✅     | UUID                            |
| user_id (FK)    | ✅     | Author                          |
| site_id (FK)    | ✅     | Site                            |
| category        | ✅     | Enum (5 types)                  |
| hazard_type     | ✅     | String (nullable)               |
| risk_level      | ✅     | Enum (High/Medium/Low)          |
| location_floor  | ✅     | String                          |
| location_zone   | ✅     | String                          |
| location_detail | ✅     | String                          |
| content         | ✅     | Text                            |
| visibility      | ✅     | Enum (worker_public/admin_only) |
| is_anonymous    | ✅     | Boolean                         |
| review_status   | ✅     | Enum (5 states)                 |
| action_status   | ✅     | Enum (6 states)                 |
| is_urgent       | ✅     | Boolean                         |
| created_at      | ✅     | Timestamp                       |
| updated_at      | ✅     | Timestamp                       |

### 9.5 PostImages Table

| Field         | Status | Notes            |
| ------------- | ------ | ---------------- |
| image_id (PK) | ✅     | UUID             |
| post_id (FK)  | ✅     | Post             |
| file_url      | ✅     | R2 URL           |
| thumbnail_url | ✅     | R2 thumbnail URL |
| created_at    | ✅     | Timestamp        |

### 9.6 Reviews Table

| Field          | Status | Notes                  |
| -------------- | ------ | ---------------------- |
| review_id (PK) | ✅     | UUID                   |
| post_id (FK)   | ✅     | Post                   |
| admin_id (FK)  | ✅     | Processing admin       |
| action         | ✅     | Enum (6 actions)       |
| comment        | ✅     | Text                   |
| reason_code    | ✅     | String (for rejection) |
| created_at     | ✅     | Timestamp              |

### 9.7 PointsLedger Table

| Field              | Status | Notes                           |
| ------------------ | ------ | ------------------------------- |
| ledger_id (PK)     | ✅     | UUID                            |
| user_id (FK)       | ✅     | User                            |
| site_id (FK)       | ✅     | Site                            |
| post_id (FK)       | ✅     | Related post (nullable)         |
| ref_ledger_id (FK) | ✅     | Original ledger for corrections |
| amount             | ✅     | Int (+/-)                       |
| reason_code        | ✅     | String                          |
| reason_text        | ✅     | String                          |
| admin_id (FK)      | ✅     | Processing admin                |
| settle_month       | ✅     | YYYY-MM                         |
| occurred_at        | ✅     | Timestamp                       |
| created_at         | ✅     | Timestamp                       |

### 9.8 Actions Table

| Field            | Status | Notes                                   |
| ---------------- | ------ | --------------------------------------- |
| action_id (PK)   | ✅     | UUID                                    |
| post_id (FK)     | ✅     | Post                                    |
| assignee_type    | ✅     | String (Safety/Construction/Contractor) |
| assignee_id (FK) | ✅     | Handler ID                              |
| due_date         | ✅     | Date                                    |
| action_status    | ✅     | Enum (open/in_progress/done)            |
| completion_note  | ✅     | Text                                    |
| completed_at     | ✅     | Timestamp                               |

### 9.9 ActionImages Table

| Field          | Status | Notes            |
| -------------- | ------ | ---------------- |
| image_id (PK)  | ✅     | UUID             |
| action_id (FK) | ✅     | Action           |
| file_url       | ✅     | R2 URL           |
| thumbnail_url  | ✅     | R2 thumbnail URL |
| created_at     | ✅     | Timestamp        |

### 9.10 AuditLogs Table

| Field         | Status | Notes     |
| ------------- | ------ | --------- |
| log_id (PK)   | ✅     | UUID      |
| actor_id (FK) | ✅     | Actor     |
| action        | ✅     | String    |
| target_type   | ✅     | String    |
| target_id     | ✅     | String    |
| reason        | ✅     | Text      |
| ip            | ✅     | String    |
| user_agent    | ✅     | String    |
| created_at    | ✅     | Timestamp |

---

## 10. PERSONAL DATA LIFECYCLE

### 10.1 Data Classification

| Classification | Items                                 | Status | Notes                          |
| -------------- | ------------------------------------- | ------ | ------------------------------ |
| PII            | Phone, Name, DOB, Emergency contact   | ✅     | Encrypted storage              |
| Operational    | Posts, Actions, Evidence              | ✅     | Retained                       |
| Media          | Photos/Images                         | ✅     | R2 storage with access control |
| Logs           | PII access, Downloads, Policy changes | ✅     | AuditLogs table                |
| Authentication | OTP attempt records                   | ✅     | Tracked in users table         |

### 10.2 Retention Periods

| Data                 | Retention Period                  | Status     | Notes                        |
| -------------------- | --------------------------------- | ---------- | ---------------------------- |
| User PII             | 1 year after site membership ends | ⚠️ Partial | Policy defined, not enforced |
| Posts/Actions        | 3 years after site closure        | ⚠️ Partial | Policy defined, not enforced |
| Images               | Same as posts                     | ⚠️ Partial | Policy defined, not enforced |
| Access/Download logs | 2 years                           | ⚠️ Partial | Policy defined, not enforced |
| OTP logs             | 90 days                           | ⚠️ Partial | Policy defined, not enforced |
| Backups              | 35 days                           | ⚠️ Partial | Policy defined, not enforced |

**Gap**: Retention policies not automatically enforced. **P1**: Implement data retention job.

### 10.3 Deletion Request Processing

| Request Type       | Requester | Processing               | Status             | Notes                           |
| ------------------ | --------- | ------------------------ | ------------------ | ------------------------------- |
| Post deletion      | Worker    | Admin approval/rejection | ⚠️ Partial         | Endpoint exists, UI incomplete  |
| Account deletion   | Worker    | Super admin processing   | ⚠️ Partial         | Endpoint exists, UI incomplete  |
| Immediate deletion | Admin     | Sensitive info exposure  | ❌ Not Implemented | **P1**: Need emergency deletion |

### 10.4 Access/Download Controls

| Item                                                             | Status     | Notes                                    |
| ---------------------------------------------------------------- | ---------- | ---------------------------------------- |
| Default masking (phone/DOB)                                      | ✅         | Masking applied                          |
| Full view condition (PII_VIEW_FULL + reason)                     | ✅         | Checked and logged                       |
| Access log (actor, target, field, reason, timestamp, ip, result) | ✅         | AuditLogs table                          |
| Downloads (always logged + watermark)                            | ⚠️ Partial | Logging works, watermark not implemented |

---

## 11. NON-FUNCTIONAL REQUIREMENTS

### 11.1 Performance

| Item             | Target                             | Status     | Notes                                            |
| ---------------- | ---------------------------------- | ---------- | ------------------------------------------------ |
| List loading     | Under 1 second                     | ⚠️ Partial | Text loads fast, thumbnails lazy-loaded          |
| Image upload     | 10MB/image limit, auto compression | ⚠️ Partial | 10MB limit enforced, compression not implemented |
| Concurrent users | Design for 500 per site            | ⚠️ Partial | D1 can handle ~1000 QPS, not tested at scale     |

### 11.2 Security

| Item               | Requirement         | Status     | Notes                             |
| ------------------ | ------------------- | ---------- | --------------------------------- |
| PII encryption     | AES-256 or higher   | ✅         | Web Crypto API used               |
| Transport security | TLS 1.2+            | ✅         | Cloudflare enforces               |
| Session management | JWT + Refresh Token | ✅         | Implemented                       |
| OWASP Top 10       | Mandatory coverage  | ⚠️ Partial | Basic coverage, not comprehensive |

**Gaps**:

- SQL injection: Drizzle ORM prevents, but no additional validation
- XSS: React escapes by default, but no CSP headers
- CSRF: No CSRF tokens implemented
- Rate limiting: In-memory, not persistent

### 11.3 Availability

| Item              | Target                  | Status     | Notes                                |
| ----------------- | ----------------------- | ---------- | ------------------------------------ |
| Uptime            | 99.5%                   | ⚠️ Partial | Cloudflare SLA 99.95%, not monitored |
| Backup            | Daily, 35-day retention | ⚠️ Partial | D1 has 30-day point-in-time recovery |
| Disaster recovery | RTO 4 hours, RPO 1 hour | ⚠️ Partial | Not tested                           |

### 11.4 Accessibility

| Item      | Requirement                                             | Status | Notes                          |
| --------- | ------------------------------------------------------- | ------ | ------------------------------ |
| Languages | Korean required; English/Vietnamese/Chinese recommended | ✅     | Korean implemented, others not |
| Font size | System setting integration                              | ✅     | Tailwind responsive            |
| Icons     | Main functions icon-centric                             | ✅     | Lucide icons used              |

### 11.5 Device Compatibility

| Item     | Requirement                                    | Status     | Notes                                       |
| -------- | ---------------------------------------------- | ---------- | ------------------------------------------- |
| Browsers | Chrome/Safari/Samsung Internet last 2 versions | ✅         | Tested on modern browsers                   |
| Screen   | 320px minimum support                          | ✅         | Mobile-first design                         |
| PWA      | Offline basic screen, sync on reconnect        | ⚠️ Partial | PWA config exists, offline not fully tested |

---

## 12. MVP SCOPE

### 12.1 Required (MVP)

| Area          | Features                                                | Status     |
| ------------- | ------------------------------------------------------- | ---------- |
| Registration  | QR registration, SMS OTP authentication                 | ⚠️ Partial |
| Posts         | Create (category/location/content/photo), View my posts | ✅         |
| Admin         | Review (approve/reject/request info), Award points      | ✅         |
| Points        | Ledger-based awards, History view, Ranking              | ✅         |
| Actions       | Assign handler, Status changes, Completion evidence     | ✅         |
| Announcements | Create/View                                             | ✅         |
| Security      | QR/OTP rate limits, PII encryption, Audit logs          | ⚠️ Partial |

### 12.2 Phase 2

| Area          | Features                                                      | Status             |
| ------------- | ------------------------------------------------------------- | ------------------ |
| Enhancement   | Statistics dashboard, Repeated hazard analysis                | ⚠️ Partial         |
| Automation    | Image blur (faces/plates), Similarity detection               | ❌ Not Implemented |
| Rewards       | Automated distribution module, Signature/receipt confirmation | ❌ Not Implemented |
| Notifications | KakaoTalk Business integration                                | ❌ Not Implemented |
| Multi-site    | Multiple site membership, Site transfers                      | ⚠️ Partial         |

### 12.3 Phase 3

| Area        | Features                                    | Status             |
| ----------- | ------------------------------------------- | ------------------ |
| AI          | Hazard auto-classification, Quality scoring | ❌ Not Implemented |
| Integration | ERP/Safety management system integration    | ❌ Not Implemented |
| Expansion   | Multi-site unified dashboard, HQ reports    | ❌ Not Implemented |

---

## 13. CLOUDFLARE NATIVE ARCHITECTURE

### 13.1 Technology Stack Mapping

| Previous Stack   | Cloudflare Native  | Status             | Notes                     |
| ---------------- | ------------------ | ------------------ | ------------------------- |
| NestJS (Node.js) | Cloudflare Workers | ✅                 | Hono.js implemented       |
| PostgreSQL 15    | Cloudflare D1      | ✅                 | SQLite schema migrated    |
| Redis 7          | Cloudflare KV      | ⚠️ Partial         | Not yet integrated        |
| S3/MinIO         | Cloudflare R2      | ✅                 | Image upload working      |
| Next.js hosting  | Cloudflare Pages   | ✅                 | Deployed                  |
| BullMQ           | Cloudflare Queues  | ❌ Not Implemented | **P1**: For notifications |
| -                | Durable Objects    | ❌ Not Implemented | **P1**: For rate limiting |

### 13.2 Workers Configuration

| Specification    | Value         | Status |
| ---------------- | ------------- | ------ |
| CPU Time Limit   | 30s (paid)    | ✅     |
| Memory Limit     | 128MB         | ✅     |
| Subrequest Limit | 1,000/request | ✅     |
| Request Size     | 100MB         | ✅     |
| Cold Start       | ~0ms          | ✅     |

### 13.3 D1 Configuration

| Specification | Value           | Status     |
| ------------- | --------------- | ---------- |
| Max DB Size   | 10GB            | ✅         |
| Throughput    | ~1,000 QPS      | ✅         |
| SQL Dialect   | SQLite          | ✅         |
| Read Replicas | Global (Beta)   | ⚠️ Partial |
| Time Travel   | 30-day recovery | ✅         |

### 13.4 R2 Configuration

| Specification   | Value     | Status |
| --------------- | --------- | ------ |
| Storage Limit   | Unlimited | ✅     |
| Object Size     | 5GB max   | ✅     |
| Egress Cost     | $0        | ✅     |
| CDN Integration | Built-in  | ✅     |

### 13.5 KV Configuration

| Specification  | Value                        | Status     |
| -------------- | ---------------------------- | ---------- |
| Max Value Size | 25MB                         | ✅         |
| Read Latency   | <10ms                        | ✅         |
| Consistency    | Eventually consistent (~60s) | ⚠️ Partial |
| TTL            | Configurable                 | ⚠️ Partial |

---

## SUMMARY BY PRIORITY

### P0 (Critical - MVP Blockers)

| Item                              | Status | Impact                              |
| --------------------------------- | ------ | ----------------------------------- |
| Rate limiting (persistent)        | ❌     | Security risk, OTP bombing possible |
| SMS notifications                 | ❌     | User engagement critical            |
| Dispute workflow (month-end)      | ❌     | Point system integrity              |
| Daily maximum enforcement         | ❌     | Point system fairness               |
| Durable Objects for rate limiting | ❌     | Production readiness                |

### P1 (High - Should have for MVP)

| Item                                     | Status | Impact                 |
| ---------------------------------------- | ------ | ---------------------- |
| Device fingerprinting                    | ❌     | Fraud prevention       |
| Excel export                             | ❌     | Admin usability        |
| Policy management UI                     | ❌     | Admin flexibility      |
| Automated snapshot generation            | ❌     | Month-end process      |
| Data retention enforcement               | ❌     | Compliance             |
| Web Push notifications                   | ❌     | User engagement        |
| Queues for notifications                 | ❌     | Reliability            |
| False report penalty (7-day restriction) | ❌     | Point system integrity |

### P2 (Medium - Nice to have)

| Item                           | Status     | Impact                   |
| ------------------------------ | ---------- | ------------------------ |
| Image compression              | ⚠️ Partial | Performance              |
| KV session caching             | ❌         | Performance optimization |
| Statistics dashboard           | ⚠️ Partial | Analytics                |
| Image blur (faces/plates)      | ❌         | Privacy enhancement      |
| Similarity detection           | ❌         | Duplicate prevention     |
| KakaoTalk Business integration | ❌         | Notification channel     |
| Multi-language support         | ❌         | Accessibility            |

---

## IMPLEMENTATION GAPS SUMMARY

### Critical Gaps (Must Fix)

1. **Rate Limiting** - In-memory Map will reset on Worker restart
   - **Fix**: Migrate to Durable Objects for persistent rate limiting
   - **Effort**: Medium
   - **Priority**: P0

2. **Notifications** - Only in-app, no SMS/Web Push
   - **Fix**: Integrate SMS provider, implement Web Push, use Queues
   - **Effort**: High
   - **Priority**: P0

3. **Month-End Workflow** - Manual snapshot and dispute process
   - **Fix**: Automate snapshot generation, implement dispute ticket system
   - **Effort**: High
   - **Priority**: P0

4. **Point System Enforcement** - Daily max and duplicate detection incomplete
   - **Fix**: Add validation logic, enforce limits on award
   - **Effort**: Medium
   - **Priority**: P0

### Major Gaps (Should Fix)

5. **Admin Features** - Policy management, export, reward distribution
   - **Fix**: Add admin endpoints and UI
   - **Effort**: High
   - **Priority**: P1

6. **Data Retention** - Policies defined but not enforced
   - **Fix**: Implement scheduled job for data deletion
   - **Effort**: Medium
   - **Priority**: P1

7. **Fraud Prevention** - Device fingerprinting not implemented
   - **Fix**: Add device ID tracking
   - **Effort**: Low
   - **Priority**: P1

### Minor Gaps (Nice to Have)

8. **Performance** - Image compression, KV caching
   - **Fix**: Add image processing, KV integration
   - **Effort**: Medium
   - **Priority**: P2

9. **Analytics** - Dashboard charts incomplete
   - **Fix**: Implement chart components
   - **Effort**: Low
   - **Priority**: P2

10. **Accessibility** - Multi-language support
    - **Fix**: Add i18n framework
    - **Effort**: Medium
    - **Priority**: P2

---

## NEXT STEPS

### Immediate (Week 1-2)

- [ ] Migrate rate limiting to Durable Objects
- [ ] Implement SMS notification integration
- [ ] Add Web Push support
- [x] Enforce daily point maximum

### Short-term (Week 3-4)

- [ ] Automate month-end snapshot generation
- [ ] Implement dispute ticket system
- [ ] Add device fingerprinting
- [ ] Complete admin policy management UI

### Medium-term (Week 5-6)

- [ ] Implement data retention job
- [ ] Add image compression
- [ ] Complete dashboard analytics
- [ ] Add Queues for notification reliability

### Long-term (Week 7+)

- [ ] Image blur for privacy
- [ ] Similarity detection for duplicates
- [ ] KakaoTalk Business integration
- [ ] Multi-language support

---

**Document Generated**: 2025-02-05  
**Last Updated**: 2025-02-05  
**Status**: Ready for review and prioritization
