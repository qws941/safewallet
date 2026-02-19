# API ROUTES

19 root route modules (8.5k LOC). Each exports a Hono app mounted in `index.ts`.

## INVENTORY

| Module             | Lines | Domain                                      | Middleware                   |
| ------------------ | ----- | ------------------------------------------- | ---------------------------- |
| education.ts       | 1533  | Courses, quizzes, questions, TBM, statutory | auth, attendance             |
| auth.ts            | 1011  | Register, login, refresh, logout, /me       | rate-limit                   |
| actions.ts         | 595   | Action CRUD, images, status transitions     | auth, attendance             |
| posts.ts           | 505   | Safety report CRUD, image upload            | auth, attendance, rate-limit |
| acetime.ts         | 459   | AceTime DB sync, photo fetch, cross-match   | (internal)                   |
| points.ts          | 432   | Award, balance, history, leaderboard        | auth                         |
| disputes.ts        | 412   | Dispute CRUD, resolve, status updates       | auth                         |
| users.ts           | 406   | Profile, memberships, data export, GDPR     | auth                         |
| notifications.ts   | 386   | Push subscribe/send, VAPID key              | auth                         |
| sites.ts           | 353   | Site CRUD, members, leave                   | auth                         |
| reviews.ts         | 336   | Review submission, post review history      | auth                         |
| announcements.ts   | 291   | Announcement CRUD                           | auth                         |
| votes.ts           | 291   | Current period, vote history, cast vote     | auth, attendance             |
| images.ts          | 296   | R2 upload, metadata query                   | auth, rate-limit             |
| policies.ts        | 279   | Access policy CRUD per site                 | auth                         |
| approvals.ts       | 272   | Approval list, approve/reject               | auth                         |
| attendance.ts      | 254   | FAS sync endpoint, today's record           | auth, fasAuth                |
| fas.ts             | 219   | FAS worker sync, worker removal             | fasAuth                      |
| recommendations.ts | 167   | Create, today's, user's recommendations     | auth                         |

## ADDING A ROUTE

1. Create `src/routes/{name}.ts`, export `new Hono<Env>()`
2. Add Zod schema in `src/validators/`
3. Use `authMiddleware` manually per handler (NOT `.use()`)
4. Use `success(c, data)` / `error(c, code, msg)` for responses
5. Call `logAuditWithContext()` on mutations
6. Mount in `src/index.ts` via `app.route("/name", nameRoutes)`

## ATTENDANCE-GATED ROUTES

These require `attendanceMiddleware` (user must be checked in):
posts, actions, education, votes.

## CROSS-CUTTING PATTERNS

- All 19 modules use manual `authMiddleware` (exception: acetime internal endpoints)
- All mutations validated with `zValidator("json", schema)`
- All state changes audited via `logAuditWithContext()`
- PII masked in responses (e.g., `nameMasked` in votes)
