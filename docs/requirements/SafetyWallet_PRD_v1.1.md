# SafetyWallet Product Requirements Document (PRD)

> **Version**: v1.2 (Cloudflare Native Architecture)  
> **Date**: 2025-02-05  
> **Audience**: Development Team (Frontend/Backend), PM, Site Operations  
> **Platform**: Mobile Web (PWA) + Admin Web (PC)

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [User & Permission Model](#2-user--permission-model)
3. [Registration & Authentication](#3-registration--authentication)
4. [Post State Model](#4-post-state-model)
5. [Worker Features](#5-worker-features)
6. [Admin Features](#6-admin-features)
7. [Point System](#7-point-system)
8. [Notification System](#8-notification-system)
9. [Data Model](#9-data-model)
10. [Personal Data Lifecycle](#10-personal-data-lifecycle)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [MVP Scope](#12-mvp-scope)
13. [Cloudflare Native Architecture](#13-cloudflare-native-architecture)

---

## 1. Service Overview

### 1.1 Problem Definition (Pain Points)

| #   | Problem                                                                  | Impact                                 |
| --- | ------------------------------------------------------------------------ | -------------------------------------- |
| 1   | Safety managers cannot continuously identify all hazards across the site | Blind spots in accident prevention     |
| 2   | Hazard reporting routes are slow or reports get lost                     | Delayed action, unclear accountability |
| 3   | Lack of worker participation incentives (rewards/feedback/visibility)    | Low safety engagement                  |

### 1.2 Goals (KPIs)

| Category    | Metric                                                               | Measurement         |
| ----------- | -------------------------------------------------------------------- | ------------------- |
| Engagement  | Registered users, MAU, Posts submitted                               | Monthly aggregate   |
| Operations  | Avg processing time (submit→review, submit→action complete), Backlog | Real-time dashboard |
| Improvement | Repeated hazard reduction rate, Proactive report increase            | Month-over-month    |

### 1.3 Core Concept

```
[Worker Safety Activity] → [Point Accumulation] → [Monthly Ranking/Rewards]
                                    ↓
                      [Admin Action/Feedback Sharing]
```

- **Safety Wallet**: Accumulate points for worker safety activities
- **Feedback Loop**: Share completed actions to sustain engagement

---

## 2. User & Permission Model

### 2.1 Role Definitions

| Role          | Description         | Default Scope    |
| ------------- | ------------------- | ---------------- |
| `WORKER`      | Construction worker | Own data only    |
| `SITE_ADMIN`  | Site administrator  | Assigned site(s) |
| `SUPER_ADMIN` | HQ administrator    | All sites        |

### 2.2 Permission Flags (Assigned to Roles)

| Flag            | Description                 | Default Assignment               |
| --------------- | --------------------------- | -------------------------------- |
| `PII_VIEW_FULL` | Unmask personal information | Not assigned (approval required) |
| `POINT_AWARD`   | Award/adjust points         | SITE_ADMIN                       |
| `EXPORT`        | Excel/image download        | Not assigned (approval required) |
| `POLICY_EDIT`   | Modify point policies       | SUPER_ADMIN                      |
| `NOTICE_EDIT`   | Create/edit announcements   | SITE_ADMIN                       |

### 2.3 Permission Matrix

| Function               | WORKER | SITE_ADMIN | SUPER_ADMIN | Notes                               |
| ---------------------- | :----: | :--------: | :---------: | ----------------------------------- |
| Register/Login         |   ✓    |     ✓      |      ✓      | OTP authentication                  |
| View/Edit own profile  |   ✓    |     ✓      |      ✓      | Phone change requires re-auth       |
| Create post            |   ✓    |     -      |      -      | Photo rules per category            |
| View/Edit own posts    |   ✓    |     -      |      -      | Edit only in `RECEIVED`             |
| View announcements     |   ✓    |     ✓      |      ✓      |                                     |
| View points/ranking    |   ✓    |     ✓      |      ✓      | Site-scoped                         |
| Admin dashboard        |   -    |     ✓      |      ✓      | Site-scoped                         |
| Review/Process posts   |   -    |     ✓      |      ✓      |                                     |
| Approve (award points) |   -    |    ✓\*     |      ✓      | \*Requires `POINT_AWARD`            |
| Adjust/Revoke points   |   -    |    ✓\*     |      ✓      | \*Requires `POINT_AWARD`            |
| Assign action handler  |   -    |     ✓      |      ✓      |                                     |
| Create announcements   |   -    |    ✓\*     |      ✓      | \*Requires `NOTICE_EDIT`            |
| Modify point policies  |   -    |     -      |      ✓      |                                     |
| Create/Manage sites    |   -    |     -      |      ✓      |                                     |
| Manage master data     |   -    |  ✓(site)   |   ✓(all)    | Companies/trades/locations          |
| Full PII view          |   -    |    ✓\*     |      ✓      | \*Requires `PII_VIEW_FULL` + reason |
| Excel/Image download   |   -    |    ✓\*     |      ✓      | \*Requires `EXPORT`                 |
| View audit logs        |   -    |  ✓(site)   |   ✓(all)    |                                     |

### 2.4 Personal Data Access Control

| Field         | Default Display            | Full View Condition            |
| ------------- | -------------------------- | ------------------------------ |
| Phone number  | `010-****-1234`            | `PII_VIEW_FULL` + reason entry |
| Date of birth | `199*-**-**`               | `PII_VIEW_FULL` + reason entry |
| Name          | Masked option (`John D**`) | Admins see full by default     |

**Required Logging**: On full view: `actor_id`, `target_user_id`, `field`, `reason`, `timestamp`, `ip`, `result`

---

## 3. Registration & Authentication

### 3.1 QR Code Structure

```
URL: https://safetywallet.site/join?code=<join_code>
```

| Item              | Specification                                                 |
| ----------------- | ------------------------------------------------------------- |
| `join_code`       | 16-24 char random (Base64url), unique per site, unpredictable |
| Server validation | `code` → lookup site → `active=true` + `join_enabled=true`    |
| Reissue           | Super admin only, previous code invalidated immediately       |
| Placement         | Site entrances, TBM areas, break rooms, elevator halls        |

### 3.2 Registration Flow

```
[QR Scan] → [Site name auto-displayed] → [Terms agreement] → [Info entry] → [SMS OTP] → [Complete]
```

### 3.3 Registration Fields

| Field             | Required | Input Type           | Validation                                                 |
| ----------------- | :------: | -------------------- | ---------------------------------------------------------- |
| Site ID           |   Auto   | Read-only            | Extracted from QR, immutable                               |
| Company           |    ✓     | Dropdown + free text | Master data based                                          |
| Trade/Job         |    ✓     | Dropdown             | Rebar/Formwork/Electrical/Plumbing/Waterproof/Welding etc. |
| Name              |    ✓     | Text                 | 2-20 chars                                                 |
| Phone             |    ✓     | Numeric              | 10-11 digits, E.164 storage, serves as account ID          |
| Date of birth     |    ✓     | Date picker          | YYYYMMDD 8 digits                                          |
| Foreign national  |    -     | Toggle               | Domestic/Foreign                                           |
| Emergency contact |    -     | Numeric              | 10-11 digits                                               |
| Privacy consent   |    ✓     | Checkbox             | Consent timestamp stored                                   |

### 3.4 Rate Limits

| Target                           | Limit          | On Exceed                     |
| -------------------------------- | -------------- | ----------------------------- |
| OTP send (phone)                 | 5/hour, 10/24h | "Please try again later"      |
| OTP send (IP)                    | 20/10min       | Same                          |
| OTP verify fail (phone)          | 5 consecutive  | 15min lockout                 |
| Registration attempt (IP)        | 30/hour        | Block/CAPTCHA                 |
| Registration attempt (device ID) | 3 accounts/24h | Switch to admin approval mode |

### 3.5 Fraud Prevention

| Scenario                             | Response                                   |
| ------------------------------------ | ------------------------------------------ |
| QR sharing for external registration | Unpredictable code + rate limits           |
| Mass OTP bombing                     | Phone/IP rate limits + failure lockout     |
| Multi-account creation               | Device ID limit + admin approval mode      |
| Duplicate phone number               | Guide to existing account + login redirect |

---

## 4. Post State Model

### 4.1 Dual-Axis State Model

**Review Status**

| Code        | Label          | Description                         |
| ----------- | -------------- | ----------------------------------- |
| `RECEIVED`  | Received       | Immediately after worker submission |
| `IN_REVIEW` | Under Review   | Admin started review                |
| `NEED_INFO` | Info Requested | Worker needs to supplement          |
| `APPROVED`  | Approved       | Points can be awarded               |
| `REJECTED`  | Rejected       | No points awarded                   |

**Action Status**

| Code          | Label           | Description                            |
| ------------- | --------------- | -------------------------------------- |
| `NONE`        | No Action       | Not an action item                     |
| `REQUIRED`    | Action Required | Designated as action item              |
| `ASSIGNED`    | Assigned        | Handler + deadline set                 |
| `IN_PROGRESS` | In Progress     | Work underway                          |
| `DONE`        | Completed       | Done + evidence uploaded               |
| `REOPENED`    | Reopened        | Issue recurred / insufficient evidence |

### 4.2 State Transition Table

| Trigger         | Actor   | Condition                  | Review Status Change | Action Status Change | System Processing                     |
| --------------- | ------- | -------------------------- | -------------------- | -------------------- | ------------------------------------- |
| Create post     | Worker  | Validation passed          | `→RECEIVED`          | `→NONE`              | Save, notify                          |
| Edit post       | Worker  | Only in `RECEIVED`         | Unchanged            | Unchanged            | Save edit history                     |
| Start review    | Admin   | `RECEIVED/NEED_INFO`       | `→IN_REVIEW`         | Unchanged            | Record reviewer                       |
| Request info    | Admin   | `IN_REVIEW`                | `→NEED_INFO`         | Unchanged            | Reason required, notify               |
| Submit info     | Worker  | `NEED_INFO`                | Unchanged            | Unchanged            | Save attachment, notify               |
| Reject          | Admin   | `IN_REVIEW/NEED_INFO`      | `→REJECTED`          | `→NONE`              | Reason required, notify               |
| Approve         | Admin   | `IN_REVIEW`                | `→APPROVED`          | Unchanged            | **Create point ledger entry**, notify |
| Mark for action | Admin   | Before/after approval      | Unchanged            | `→REQUIRED`          |                                       |
| Assign handler  | Admin   | `REQUIRED`                 | Unchanged            | `→ASSIGNED`          | Handler + deadline required, notify   |
| Start action    | Handler | `ASSIGNED`                 | Unchanged            | `→IN_PROGRESS`       |                                       |
| Complete action | Handler | `IN_PROGRESS`, 1+ evidence | Unchanged            | `→DONE`              | **Award completion bonus**, notify    |
| Reopen          | Admin   | `DONE`                     | Unchanged            | `→REOPENED`          | Reason required                       |

### 4.3 Worker Edit Permissions

- **Allowed**: Only in `RECEIVED` status
- **Blocked**: After review starts (`IN_REVIEW` onwards)
- **Exception**: In `NEED_INFO`, only supplementary attachments allowed

---

## 5. Worker Features

### 5.1 Home Screen

| Area                 | Content                                                   |
| -------------------- | --------------------------------------------------------- |
| Header               | Site name, My name (masking option)                       |
| Points card          | This month's points, Cumulative points                    |
| Ranking card         | This month's rank (e.g., #12)                             |
| CTA button           | "Submit Report/Suggestion"                                |
| Announcement preview | Latest 3 (Top performer, Best practice, Action completed) |
| (Optional)           | Daily check-in (Zero-accident attendance)                 |

### 5.2 Post Creation

#### Common Fields

| Field            | Required | Input Type | Notes                                                         |
| ---------------- | :------: | ---------- | ------------------------------------------------------------- |
| Category         |    ✓     | Radio      | Hazard/Unsafe Behavior/Inconvenience/Suggestion/Best Practice |
| Floor/Zone       |    ✓     | Dropdown   | B4~RF, Zone A/B etc.                                          |
| Location detail  |    ✓     | Text       | e.g., "B2 east ramp entrance"                                 |
| Risk level       |    -     | Select     | High/Medium/Low                                               |
| Content          |    ✓     | Text       | Min 20 chars recommended                                      |
| Photo            |    \*    | Image      | Varies by category                                            |
| Anonymous option |    -     | Toggle     | "Anonymous to workers" default ON                             |

#### Category-Specific Fields

| Category        | Additional Fields                                                                                |    Photo    | Visibility     |
| --------------- | ------------------------------------------------------------------------------------------------ | :---------: | -------------- |
| Hazard          | Type (Fall/Drop/Pinch/Electric/Fire/Collapse etc.), Immediate action possible, Action suggestion | Required 1+ | All            |
| Unsafe Behavior | Behavior type (No helmet, No harness etc.)                                                       | Required 1+ | **Admin only** |
| Inconvenience   | Type (Pathway/Lighting/Ventilation/Noise etc.), Frequency (Daily/Sometimes/First time)           |  Optional   | All            |
| Suggestion      | Suggestion type, Expected benefit, Contact consent if adopted                                    |  Optional   | All            |
| Best Practice   | Before/After photos, Improvement description                                                     |  Optional   | All            |

**Unsafe Behavior popup on submit**: "This is for improvement purposes, not personal punishment. Be careful not to expose faces/personal information."

### 5.3 My Posts

| Field     | Display                       |
| --------- | ----------------------------- |
| Thumbnail | First image                   |
| Category  | Icon + text                   |
| Status    | Review status + Action status |
| Points    | Awarded points (if approved)  |
| Feedback  | Rejection/request reason      |

### 5.4 Points/Ranking

| Item                | Description                             |
| ------------------- | --------------------------------------- |
| This month's points | 1st to last day of month                |
| Cumulative points   | All-time total                          |
| Point history       | Date, reason, points, related post link |
| Ranking             | Top 10 + my rank, names masked          |
| Tie-breaker         | Approval count > Earlier achievement    |

### 5.5 Announcements

| Type                 | Content                        |
| -------------------- | ------------------------------ |
| Ranking announcement | Monthly top 3                  |
| Best practice        | Selected post shared           |
| Action completed     | Case improved thanks to report |
| Reward notice        | Distribution schedule/method   |

---

## 6. Admin Features

### 6.1 Dashboard

| Card                | Content                         |
| ------------------- | ------------------------------- |
| Today's submissions | Posts registered today          |
| Backlog             | Pending review count            |
| Urgent              | Urgent-flagged count            |
| Avg processing time | This month                      |
| Category chart      | Distribution by type            |
| Hotspots            | Top unprocessed locations/types |

### 6.2 Review Queue

**Filters**

- Site, Company, Trade, Category, Risk level, Status, Date range
- "Urgent only" toggle

**Sorting**

- Pending first, Urgent first, Newest first

**List Card**

- Thumbnail, Category, Location, Date, Status, Risk level, Author (masked)

### 6.3 Post Detail Processing

#### Processing Actions

| Action        | Required Input                      | Result                      |
| ------------- | ----------------------------------- | --------------------------- |
| Approve       | Points (auto-suggested, adjustable) | Create ledger entry, notify |
| Reject        | Reason code + comment               | Notify                      |
| Request info  | Template selection                  | Notify                      |
| Mark urgent   | Handler, deadline                   | Urgent flag                 |
| Assign action | Handler, deadline                   | Change action status        |

#### Rejection Reasons (Codes)

| Code            | Display                  |
| --------------- | ------------------------ |
| `DUPLICATE`     | Duplicate report         |
| `UNCLEAR_PHOTO` | Photo unclear            |
| `INSUFFICIENT`  | Insufficient content     |
| `FALSE`         | False report             |
| `IRRELEVANT`    | Unrelated to improvement |
| `OTHER`         | Other (comment required) |

### 6.4 Point Policy Management

| Item                    | Description                   | Default              |
| ----------------------- | ----------------------------- | -------------------- |
| Category base points    | Base points per type          | See Section 7        |
| Risk level bonus        | High/Medium/Low additional    | +5/+3/+0             |
| Action completion bonus | Additional on action complete | +5~+20 (selectable)  |
| Daily maximum           | Daily cap                     | 30 points or 3 posts |
| Duplicate criteria      | Same determination condition  | Location+Type+24h    |

### 6.5 Reward Management

| Function            | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| Month selection     | Settlement target month                                             |
| Auto ranking        | Calculate from snapshot                                             |
| Reward criteria     | 1st/2nd/3rd amounts or achievement conditions                       |
| Distribution record | Method, date, handler, notes                                        |
| Excel download      | Name (masked), Company, Trade, Phone (masked), Points, Rank, Reward |

### 6.6 Announcement Management

| Function       | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| Templates      | Auto-generate for Top performer, Best practice, Action complete |
| Display period | Start/end date setting                                          |
| Target         | All/Per site                                                    |

---

## 7. Point System

### 7.1 Base Points

| Category        | Base Points | Notes              |
| --------------- | :---------: | ------------------ |
| Hazard          |     10      |                    |
| Unsafe Behavior |      8      | Sensitive category |
| Inconvenience   |      5      |                    |
| Suggestion      |      5      | +15 if adopted     |
| Best Practice   |     10      |                    |

### 7.2 Bonus Rules

| Condition         |         Bonus          |
| ----------------- | :--------------------: |
| Risk level High   |           +5           |
| Risk level Medium |           +3           |
| Risk level Low    |           +0           |
| Action completed  | +5~+20 (admin selects) |
| Info supplemented |  +2 (first time only)  |

### 7.3 Limit Rules

| Rule                 | Content                           |
| -------------------- | --------------------------------- |
| Daily maximum        | 30 points or 3 posts              |
| Duplicate/Repeat     | Same location+type+24h = 0 points |
| False report penalty | 3 cumulative = 7-day restriction  |

### 7.4 Ledger Rules

| Principle     | Description                                                |
| ------------- | ---------------------------------------------------------- |
| Immutability  | No modification/deletion of existing rows, only additions  |
| Reference key | Adjustments/revokes reference original via `ref_ledger_id` |
| Evidence      | `reason_code` + `reason_text` + `post_id` required         |

### 7.5 Monthly Attribution

| Event                   | Attribution Month                              |
| ----------------------- | ---------------------------------------------- |
| Approval points         | Based on approval timestamp                    |
| Action completion bonus | Based on completion timestamp                  |
| Adjustment/Revoke       | Based on adjustment timestamp (no retroactive) |

### 7.6 Month-End / Dispute Flow

```
[Month end 23:59:59] → [Snapshot generated D+1~3] → [7-day dispute period] → [Corrections processed] → [Rewards finalized]
```

| Stage               | Timing                         | Output                    |
| ------------------- | ------------------------------ | ------------------------- |
| Month end           | Last day 23:59:59 KST          | -                         |
| Snapshot generation | Next month D+1~3 business days | Ranking snapshot          |
| Dispute period      | 7 days after snapshot          | Dispute tickets           |
| Corrections         | Within dispute period          | Correction ledger entries |
| Reward finalization | After dispute period           | Distribution list         |

### 7.7 Adjustment/Revoke Cases

| Case                       | Processing                    | Authority            |
| -------------------------- | ----------------------------- | -------------------- |
| False report determination | Add deduction ledger entry    | `POINT_AWARD`        |
| Duplicate award            | Add deduction ledger entry    | `POINT_AWARD`        |
| Action completion revoked  | Deduct completion bonus       | `POINT_AWARD`        |
| Retroactive policy change  | **Principle: No retroactive** | SUPER_ADMIN override |

---

## 8. Notification System

### 8.1 Notification Scenarios

| Trigger             | Recipient | Example Message                                                       |
| ------------------- | --------- | --------------------------------------------------------------------- |
| Submission complete | Worker    | "Your report has been received. Points will be awarded after review." |
| Info requested      | Worker    | "The photo is unclear. Please submit additional photos."              |
| Approved            | Worker    | "Approved! +10 points earned!"                                        |
| Rejected            | Worker    | "Rejected. Reason: Duplicate report"                                  |
| Action completed    | Worker    | "The issue you reported has been resolved."                           |
| Announcement posted | All       | "This month's top performer announced! Check announcements"           |
| Handler assigned    | Handler   | "A new action item has been assigned to you."                         |

### 8.2 Channel Priority

| Priority | Channel            | Constraints                   |
| :------: | ------------------ | ----------------------------- |
|    1     | Web Push (PWA)     | iOS/some browsers unsupported |
|    2     | SMS                | Cost incurred                 |
|    3     | KakaoTalk Business | Business integration required |

### 8.3 Fallback Rules

- Web push fails → SMS (critical notifications only)
- SMS not configured → In-app notification center
- Notification center always records

---

## 9. Data Model

### 9.1 Users

| Field               | Type      | Description                      |
| ------------------- | --------- | -------------------------------- |
| `user_id`           | PK        | UUID                             |
| `phone_hash`        | string    | Phone hash (for duplicate check) |
| `phone_encrypted`   | string    | Phone encrypted                  |
| `name`              | string    | Name                             |
| `dob_encrypted`     | string    | DOB encrypted                    |
| `nationality_flag`  | enum      | Domestic/Foreign                 |
| `emergency_contact` | string    | Emergency contact (optional)     |
| `status`            | enum      | active/pending/blocked           |
| `created_at`        | timestamp | Registration time                |
| `last_login_at`     | timestamp | Last login                       |

### 9.2 SiteMemberships

| Field           | Type      | Description                |
| --------------- | --------- | -------------------------- |
| `membership_id` | PK        | UUID                       |
| `user_id`       | FK        | User                       |
| `site_id`       | FK        | Site                       |
| `company_name`  | string    | Company                    |
| `trade_type`    | string    | Trade/Job                  |
| `joined_at`     | timestamp | Site join date             |
| `left_at`       | timestamp | Site leave date (nullable) |

### 9.3 Sites

| Field               | Type      | Description                      |
| ------------------- | --------- | -------------------------------- |
| `site_id`           | PK        | UUID                             |
| `name`              | string    | Site name                        |
| `join_code`         | string    | QR join code (16-24 char random) |
| `active`            | boolean   | Active status                    |
| `join_enabled`      | boolean   | Registration allowed             |
| `requires_approval` | boolean   | Admin approval required          |
| `created_at`        | timestamp | Creation time                    |
| `closed_at`         | timestamp | Closure time (nullable)          |

### 9.4 Posts

| Field             | Type      | Description                                                 |
| ----------------- | --------- | ----------------------------------------------------------- |
| `post_id`         | PK        | UUID                                                        |
| `user_id`         | FK        | Author                                                      |
| `site_id`         | FK        | Site                                                        |
| `category`        | enum      | Hazard/UnsafeBehavior/Inconvenience/Suggestion/BestPractice |
| `hazard_type`     | string    | Sub-type (nullable)                                         |
| `risk_level`      | enum      | High/Medium/Low (nullable)                                  |
| `location_floor`  | string    | Floor                                                       |
| `location_zone`   | string    | Zone                                                        |
| `location_detail` | string    | Detail location                                             |
| `content`         | text      | Content                                                     |
| `visibility`      | enum      | worker_public/admin_only                                    |
| `is_anonymous`    | boolean   | Anonymous flag                                              |
| `review_status`   | enum      | RECEIVED/IN_REVIEW/NEED_INFO/APPROVED/REJECTED              |
| `action_status`   | enum      | NONE/REQUIRED/ASSIGNED/IN_PROGRESS/DONE/REOPENED            |
| `is_urgent`       | boolean   | Urgent flag                                                 |
| `created_at`      | timestamp | Creation time                                               |
| `updated_at`      | timestamp | Update time                                                 |

### 9.5 PostImages

| Field           | Type      | Description   |
| --------------- | --------- | ------------- |
| `image_id`      | PK        | UUID          |
| `post_id`       | FK        | Post          |
| `file_url`      | string    | Original URL  |
| `thumbnail_url` | string    | Thumbnail URL |
| `created_at`    | timestamp | Upload time   |

### 9.6 Reviews

| Field         | Type      | Description                                          |
| ------------- | --------- | ---------------------------------------------------- |
| `review_id`   | PK        | UUID                                                 |
| `post_id`     | FK        | Post                                                 |
| `admin_id`    | FK        | Processing admin                                     |
| `action`      | enum      | approve/reject/request_more/mark_urgent/assign/close |
| `comment`     | text      | Comment                                              |
| `reason_code` | string    | Reason code (for rejection)                          |
| `created_at`  | timestamp | Processing time                                      |

### 9.7 PointsLedger

| Field           | Type      | Description                                |
| --------------- | --------- | ------------------------------------------ |
| `ledger_id`     | PK        | UUID                                       |
| `user_id`       | FK        | User                                       |
| `site_id`       | FK        | Site                                       |
| `post_id`       | FK        | Related post (nullable)                    |
| `ref_ledger_id` | FK        | Original ledger for corrections (nullable) |
| `amount`        | int       | Points (+/-)                               |
| `reason_code`   | string    | Reason code                                |
| `reason_text`   | string    | Reason description                         |
| `admin_id`      | FK        | Processing admin                           |
| `settle_month`  | string    | Attribution month (YYYY-MM)                |
| `occurred_at`   | timestamp | Occurrence time                            |
| `created_at`    | timestamp | Storage time                               |

### 9.8 Actions

| Field             | Type      | Description                                   |
| ----------------- | --------- | --------------------------------------------- |
| `action_id`       | PK        | UUID                                          |
| `post_id`         | FK        | Post                                          |
| `assignee_type`   | string    | Handler type (Safety/Construction/Contractor) |
| `assignee_id`     | FK        | Handler ID                                    |
| `due_date`        | date      | Action deadline                               |
| `action_status`   | enum      | open/in_progress/done                         |
| `completion_note` | text      | Completion notes                              |
| `completed_at`    | timestamp | Completion time                               |

### 9.9 ActionImages

| Field           | Type      | Description   |
| --------------- | --------- | ------------- |
| `image_id`      | PK        | UUID          |
| `action_id`     | FK        | Action        |
| `file_url`      | string    | Original URL  |
| `thumbnail_url` | string    | Thumbnail URL |
| `created_at`    | timestamp | Upload time   |

### 9.10 AuditLogs

| Field         | Type      | Description                         |
| ------------- | --------- | ----------------------------------- |
| `log_id`      | PK        | UUID                                |
| `actor_id`    | FK        | Actor                               |
| `action`      | string    | Action type                         |
| `target_type` | string    | Target type (user/post/ledger etc.) |
| `target_id`   | string    | Target ID                           |
| `reason`      | text      | Reason                              |
| `ip`          | string    | IP address                          |
| `user_agent`  | string    | UA                                  |
| `created_at`  | timestamp | Occurrence time                     |

---

## 10. Personal Data Lifecycle

### 10.1 Data Classification

| Classification | Items                                 | Processing                        |
| -------------- | ------------------------------------- | --------------------------------- |
| PII            | Phone, Name, DOB, Emergency contact   | Encrypted storage                 |
| Operational    | Posts, Actions, Evidence              | Principle: retain                 |
| Media          | Photos/Images                         | Access control + download logging |
| Logs           | PII access, Downloads, Policy changes | WORM storage                      |
| Authentication | OTP attempt records                   | Short-term retention then purge   |

### 10.2 Retention Periods

| Data                 | Retention Period                  | Reference Point      |
| -------------------- | --------------------------------- | -------------------- |
| User PII             | 1 year after site membership ends | `left_at`            |
| Posts/Actions        | 3 years after site closure        | `site.closed_at`     |
| Images               | Same as posts                     | -                    |
| Access/Download logs | 2 years                           | Log creation date    |
| OTP logs             | 90 days                           | Log creation date    |
| Backups              | 35 days                           | Backup creation date |

### 10.3 Deletion Request Processing

| Request Type       | Requester | Processing               | Result                               |
| ------------------ | --------- | ------------------------ | ------------------------------------ |
| Post deletion      | Worker    | Admin approval/rejection | Soft delete (metadata only retained) |
| Account deletion   | Worker    | Super admin processing   | Anonymization + access block         |
| Immediate deletion | Admin     | Sensitive info exposure  | Hide + isolated storage              |

### 10.4 Access/Download Controls

| Item                | Requirement                                         |
| ------------------- | --------------------------------------------------- |
| Default masking     | Phone/DOB displayed masked                          |
| Full view condition | `PII_VIEW_FULL` + reason entry                      |
| Access log          | actor, target, field, reason, timestamp, ip, result |
| Downloads           | Always logged + (recommended) watermark             |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Item             | Target                                       |
| ---------------- | -------------------------------------------- |
| List loading     | Under 1 second (text first, thumbnails lazy) |
| Image upload     | 10MB/image limit, auto compression           |
| Concurrent users | Design for 500 per site                      |

### 11.2 Security

| Item               | Requirement         |
| ------------------ | ------------------- |
| PII encryption     | AES-256 or higher   |
| Transport security | TLS 1.2+            |
| Session management | JWT + Refresh Token |
| OWASP Top 10       | Mandatory coverage  |

### 11.3 Availability

| Item              | Target                  |
| ----------------- | ----------------------- |
| Uptime            | 99.5%                   |
| Backup            | Daily, 35-day retention |
| Disaster recovery | RTO 4 hours, RPO 1 hour |

### 11.4 Accessibility

| Item      | Requirement                                             |
| --------- | ------------------------------------------------------- |
| Languages | Korean required; English/Vietnamese/Chinese recommended |
| Font size | System setting integration                              |
| Icons     | Main functions icon-centric                             |

### 11.5 Device Compatibility

| Item     | Requirement                                    |
| -------- | ---------------------------------------------- |
| Browsers | Chrome/Safari/Samsung Internet last 2 versions |
| Screen   | 320px minimum support                          |
| PWA      | Offline basic screen, sync on reconnect        |

---

## 12. MVP Scope

### 12.1 Required (MVP)

| Area          | Features                                                |
| ------------- | ------------------------------------------------------- |
| Registration  | QR registration, SMS OTP authentication                 |
| Posts         | Create (category/location/content/photo), View my posts |
| Admin         | Review (approve/reject/request info), Award points      |
| Points        | Ledger-based awards, History view, Ranking              |
| Actions       | Assign handler, Status changes, Completion evidence     |
| Announcements | Create/View                                             |
| Security      | QR/OTP rate limits, PII encryption, Audit logs          |

### 12.2 Phase 2

| Area          | Features                                                      |
| ------------- | ------------------------------------------------------------- |
| Enhancement   | Statistics dashboard, Repeated hazard analysis                |
| Automation    | Image blur (faces/plates), Similarity detection               |
| Rewards       | Automated distribution module, Signature/receipt confirmation |
| Notifications | KakaoTalk Business integration                                |
| Multi-site    | Multiple site membership, Site transfers                      |

### 12.3 Phase 3

| Area        | Features                                    |
| ----------- | ------------------------------------------- |
| AI          | Hazard auto-classification, Quality scoring |
| Integration | ERP/Safety management system integration    |
| Expansion   | Multi-site unified dashboard, HQ reports    |

---

## Appendix A: Status Code Definitions

### A.1 Review Status (ReviewStatus)

```typescript
enum ReviewStatus {
  RECEIVED = "RECEIVED", // Received
  IN_REVIEW = "IN_REVIEW", // Under Review
  NEED_INFO = "NEED_INFO", // Info Requested
  APPROVED = "APPROVED", // Approved
  REJECTED = "REJECTED", // Rejected
}
```

### A.2 Action Status (ActionStatus)

```typescript
enum ActionStatus {
  NONE = "NONE", // No Action
  REQUIRED = "REQUIRED", // Action Required
  ASSIGNED = "ASSIGNED", // Assigned
  IN_PROGRESS = "IN_PROGRESS", // In Progress
  DONE = "DONE", // Completed
  REOPENED = "REOPENED", // Reopened
}
```

### A.3 Category

```typescript
enum Category {
  HAZARD = "HAZARD", // Hazard
  UNSAFE_BEHAVIOR = "UNSAFE_BEHAVIOR", // Unsafe Behavior
  INCONVENIENCE = "INCONVENIENCE", // Inconvenience
  SUGGESTION = "SUGGESTION", // Suggestion
  BEST_PRACTICE = "BEST_PRACTICE", // Best Practice
}
```

### A.4 Rejection Reason (RejectReason)

```typescript
enum RejectReason {
  DUPLICATE = "DUPLICATE", // Duplicate report
  UNCLEAR_PHOTO = "UNCLEAR_PHOTO", // Photo unclear
  INSUFFICIENT = "INSUFFICIENT", // Insufficient content
  FALSE = "FALSE", // False report
  IRRELEVANT = "IRRELEVANT", // Unrelated to improvement
  OTHER = "OTHER", // Other
}
```

---

## Appendix B: Mandatory Audit Log Items

| Action               | Required Fields                                                |
| -------------------- | -------------------------------------------------------------- |
| PII full view        | actor, target_user, field, reason, timestamp, ip               |
| Excel download       | actor, filter_conditions, row_count, timestamp, ip             |
| Image download       | actor, image_ids, timestamp, ip                                |
| Point award/adjust   | actor, user, amount, reason, post_id, timestamp                |
| Policy change        | actor, policy_key, old_value, new_value, timestamp             |
| Permission change    | actor, target_user, role/flag, action(grant/revoke), timestamp |
| Forced status change | actor, post_id, old_status, new_status, reason, timestamp      |

---

---

## 13. Cloudflare Native Architecture

> **Migration Target**: Replace traditional cloud infrastructure with Cloudflare's serverless platform for global edge deployment, reduced latency, and simplified operations.

### 13.1 Technology Stack Mapping

| Previous Stack   | Cloudflare Native      | Purpose                      | Migration Notes                 |
| ---------------- | ---------------------- | ---------------------------- | ------------------------------- |
| NestJS (Node.js) | **Cloudflare Workers** | Backend API                  | Hono.js framework recommended   |
| PostgreSQL 15    | **Cloudflare D1**      | Relational database          | SQLite-based, 10GB per DB limit |
| Redis 7          | **Cloudflare KV**      | Session cache, rate limiting | Eventually consistent (60s)     |
| S3/MinIO         | **Cloudflare R2**      | Image/file storage           | Zero egress fees, S3-compatible |
| Next.js hosting  | **Cloudflare Pages**   | Frontend hosting             | Edge SSR support                |
| BullMQ           | **Cloudflare Queues**  | Background jobs              | Durable message queuing         |
| -                | **Durable Objects**    | Real-time coordination       | Rate limiting, counters         |

### 13.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Global Network                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Worker PWA  │    │  Admin Web   │    │   QR Pages   │       │
│  │   (Pages)    │    │   (Pages)    │    │   (Pages)    │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                     │
│                             ▼                                     │
│                 ┌───────────────────────┐                        │
│                 │   Cloudflare Workers  │                        │
│                 │   (Hono.js API)       │                        │
│                 └───────────┬───────────┘                        │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │     D1      │    │     KV      │    │     R2      │          │
│  │  (SQLite)   │    │   (Cache)   │    │  (Storage)  │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                   │
│         ┌───────────────────────────────────────┐                │
│         │                                       │                │
│         ▼                                       ▼                │
│  ┌─────────────┐                       ┌──────────────┐          │
│  │   Queues    │                       │   Durable    │          │
│  │  (Jobs)     │                       │   Objects    │          │
│  └─────────────┘                       └──────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 13.3 Service Specifications

#### 13.3.1 Cloudflare Workers (Compute)

| Specification    | Value         | Notes                        |
| ---------------- | ------------- | ---------------------------- |
| CPU Time Limit   | 30s (paid)    | Sufficient for API endpoints |
| Memory Limit     | 128MB         | Stateless design required    |
| Subrequest Limit | 1,000/request | External API calls           |
| Request Size     | 100MB         | File upload limit            |
| Cold Start       | ~0ms          | Always-warm at edge          |

**Framework**: [Hono.js](https://hono.dev/) - Lightweight, TypeScript-first, Workers-native

```typescript
// Example: Worker API structure
import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());
app.use("/api/*", jwt({ secret: "JWT_SECRET" }));

app.route("/api/auth", authRoutes);
app.route("/api/posts", postRoutes);
app.route("/api/points", pointRoutes);

export default app;
```

#### 13.3.2 Cloudflare D1 (Database)

| Specification | Value                         | Impact                             |
| ------------- | ----------------------------- | ---------------------------------- |
| Max DB Size   | **10GB**                      | Sufficient for single-site MVP     |
| Throughput    | ~1,000 QPS @ 1ms queries      | Single-threaded, queue on overload |
| SQL Dialect   | SQLite                        | Prisma D1 adapter available        |
| Read Replicas | Global (Beta)                 | Reduced read latency               |
| Time Travel   | 30-day point-in-time recovery | Built-in backup                    |

**Design Considerations**:

- **Per-Site Database**: Create separate D1 databases per construction site for horizontal scaling
- **Multi-tenant Option**: Single DB with site_id partitioning for MVP simplicity
- **Index Optimization**: Critical for maintaining <1ms query times

```sql
-- Index strategy for D1 performance
CREATE INDEX idx_posts_site_status ON posts(site_id, review_status);
CREATE INDEX idx_posts_site_created ON posts(site_id, created_at DESC);
CREATE INDEX idx_ledger_user_month ON points_ledger(user_id, site_id, settle_month);
```

#### 13.3.3 Cloudflare KV (Cache/Sessions)

| Specification  | Value                        | Use Case             |
| -------------- | ---------------------------- | -------------------- |
| Max Value Size | 25MB                         | Session data, config |
| Read Latency   | <10ms (edge)                 | Fast session lookup  |
| Consistency    | Eventually consistent (~60s) | Not for counters     |
| TTL            | Configurable                 | Session expiry       |

**Usage Patterns**:

| Use Case          | Key Pattern             | TTL | Notes                                 |
| ----------------- | ----------------------- | --- | ------------------------------------- |
| Session           | `session:{token}`       | 7d  | JWT refresh token data                |
| Rate Limit Window | `rate:{ip}:{window}`    | 1h  | Use Durable Objects for strict limits |
| Site Config       | `site:{site_id}:config` | 5m  | Point policies, settings              |
| OTP               | `otp:{phone}:{code}`    | 5m  | One-time verification                 |

#### 13.3.4 Cloudflare R2 (Object Storage)

| Specification   | Value     | Notes                     |
| --------------- | --------- | ------------------------- |
| Storage Limit   | Unlimited | Pay per GB                |
| Object Size     | 5GB max   | Multipart for large files |
| Egress Cost     | **$0**    | Major cost advantage      |
| CDN Integration | Built-in  | Transform via Images API  |

**Image Upload Flow**:

```typescript
// Presigned URL generation for client upload
async function getUploadUrl(env: Env, filename: string) {
  const key = `posts/${crypto.randomUUID()}/${filename}`;
  const signedUrl = await env.R2_BUCKET.createSignedUrl(key, {
    method: "PUT",
    expiresIn: 3600, // 1 hour
  });
  return { key, uploadUrl: signedUrl };
}

// After upload: generate thumbnail via Images API
async function processImage(env: Env, key: string) {
  const object = await env.R2_BUCKET.get(key);
  // Use Cloudflare Images for transformation
  return {
    original: `https://r2.safetywallet.site/${key}`,
    thumbnail: `https://r2.safetywallet.site/${key}?width=200`,
  };
}
```

#### 13.3.5 Cloudflare Queues (Background Jobs)

| Specification | Value              | Notes                 |
| ------------- | ------------------ | --------------------- |
| Message Size  | 128KB              | JSON payloads         |
| Retention     | 4 days             | Auto-retry on failure |
| Batching      | Up to 100 messages | Efficient processing  |
| Delay         | Up to 7 days       | Scheduled tasks       |

**Job Types**:

| Job                 | Trigger         | Processing                 |
| ------------------- | --------------- | -------------------------- |
| `notification.push` | Post approval   | Send FCM push notification |
| `notification.sms`  | Critical alerts | Send SMS via external API  |
| `image.thumbnail`   | Image upload    | Generate thumbnails        |
| `report.monthly`    | Scheduled       | Generate monthly rankings  |
| `audit.cleanup`     | Scheduled       | Archive old audit logs     |

```typescript
// Queue consumer example
export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env) {
    for (const message of batch.messages) {
      switch (message.body.type) {
        case "notification.push":
          await sendPushNotification(env, message.body.payload);
          break;
        case "image.thumbnail":
          await generateThumbnail(env, message.body.payload);
          break;
      }
      message.ack();
    }
  },
};
```

#### 13.3.6 Durable Objects (Stateful Coordination)

| Use Case               | Why Durable Objects          | Alternative                 |
| ---------------------- | ---------------------------- | --------------------------- |
| Rate Limiting (Strict) | Strongly consistent counters | KV is eventually consistent |
| OTP Attempt Tracking   | Atomic increment/lockout     | Prevents race conditions    |
| Real-time Dashboard    | WebSocket coordination       | SSE fallback                |
| Distributed Lock       | Exclusive access             | D1 row locking insufficient |

```typescript
// Rate limiter Durable Object
export class RateLimiter implements DurableObject {
  private requests: Map<string, number[]> = new Map();

  async fetch(request: Request): Promise<Response> {
    const key = new URL(request.url).searchParams.get("key")!;
    const limit = parseInt(request.headers.get("X-Rate-Limit") || "5");
    const window = parseInt(request.headers.get("X-Rate-Window") || "3600");

    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const valid = timestamps.filter((t) => t > now - window * 1000);

    if (valid.length >= limit) {
      return new Response("Rate limited", { status: 429 });
    }

    valid.push(now);
    this.requests.set(key, valid);

    return new Response("OK", {
      headers: { "X-Rate-Remaining": String(limit - valid.length) },
    });
  }
}
```

### 13.4 Cloudflare Pages Configuration

#### 13.4.1 Worker PWA (Next.js)

```toml
# wrangler.toml for Worker PWA
name = "safetywallet-worker"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".vercel/output/static"

[[d1_databases]]
binding = "DB"
database_name = "safetywallet-db"
database_id = "<database-id>"

[[kv_namespaces]]
binding = "KV"
id = "<kv-namespace-id>"

[[r2_buckets]]
binding = "R2"
bucket_name = "safetywallet-uploads"

[[queues.producers]]
binding = "QUEUE"
queue = "safetywallet-jobs"
```

#### 13.4.2 PWA Manifest

```json
{
  "name": "SafetyWallet",
  "short_name": "SafeWallet",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 13.5 Migration Considerations

#### 13.5.1 D1 Limitations to Address

| Limitation           | Impact                           | Mitigation                             |
| -------------------- | -------------------------------- | -------------------------------------- |
| 10GB database limit  | Large sites may exceed           | Per-site databases, archive old data   |
| Single-threaded      | High concurrency bottleneck      | Read replicas, query optimization      |
| No stored procedures | Business logic in Workers        | Move all logic to application layer    |
| SQLite syntax        | Some PostgreSQL features missing | Adapt queries (e.g., no `RETURNING *`) |

#### 13.5.2 Authentication Adaptation

| Original Approach    | Cloudflare Adaptation             |
| -------------------- | --------------------------------- |
| Passport.js + JWT    | Hono.js JWT middleware            |
| Redis session store  | KV for refresh tokens             |
| bcrypt for passwords | Web Crypto API                    |
| Rate limit (Redis)   | Durable Objects for strict limits |

#### 13.5.3 Data Migration Path

```bash
# 1. Export PostgreSQL to SQLite-compatible format
pg_dump --inserts --no-owner safetywallet > dump.sql

# 2. Convert to D1-compatible SQL
# (Handle PostgreSQL-specific syntax)

# 3. Import to D1
wrangler d1 execute safetywallet-db --file=./migration.sql
```

### 13.6 Cost Comparison (Estimated Monthly)

| Resource  | Traditional (AWS/GCP)   | Cloudflare Native     |
| --------- | ----------------------- | --------------------- |
| Compute   | $50-100 (ECS/GKE)       | $5-20 (Workers)       |
| Database  | $30-100 (RDS/Cloud SQL) | $5-10 (D1)            |
| Cache     | $15-30 (ElastiCache)    | Included in Workers   |
| Storage   | $5-20 (S3 + egress)     | $5-10 (R2, no egress) |
| CDN       | $10-50 (CloudFront)     | Included              |
| **Total** | **$110-300/month**      | **$15-40/month**      |

_Based on: 10,000 daily active users, 500GB storage, 50GB/day bandwidth_

### 13.7 External Service Integration

| Service          | Cloudflare Approach   | Notes                        |
| ---------------- | --------------------- | ---------------------------- |
| SMS (Twilio/NHN) | Worker fetch() to API | No change required           |
| Push (FCM)       | Worker fetch() to API | No change required           |
| Encryption       | Web Crypto API        | Native browser APIs          |
| Image Processing | Cloudflare Images     | Or Sharp in Worker (limited) |

### 13.8 Wrangler Configuration Reference

```toml
# Complete wrangler.toml for API Worker
name = "safetywallet-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
APP_URL = "https://safetywallet.site"

# Secrets (set via wrangler secret put)
# JWT_SECRET, ENCRYPTION_KEY, TWILIO_AUTH_TOKEN, FCM_SERVER_KEY

[[d1_databases]]
binding = "DB"
database_name = "safetywallet-prod"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[kv_namespaces]]
binding = "SESSIONS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "CONFIG"
id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "safetywallet-uploads-prod"

[[queues.producers]]
binding = "JOBS"
queue = "safetywallet-jobs-prod"

[[queues.consumers]]
queue = "safetywallet-jobs-prod"
max_batch_size = 10
max_batch_timeout = 30

[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"

[[migrations]]
tag = "v1"
new_classes = ["RateLimiter"]
```

---

## Change History

| Version | Date       | Changes                                                                                                                                    |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| v1.0    | -          | Initial draft                                                                                                                              |
| v1.1    | 2025-02-05 | Oracle review applied: Dual-axis state model, Permission matrix, Point settlement rules, QR/registration security, Personal data lifecycle |
| v1.2    | 2025-02-05 | Cloudflare Native architecture: Workers, D1, KV, R2, Queues, Durable Objects, cost comparison                                              |
