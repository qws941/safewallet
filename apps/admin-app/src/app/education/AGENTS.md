# ADMIN EDUCATION PAGES

## OVERVIEW

Education management pages for content, quizzes, and completion tracking.

## WHERE TO LOOK

| Task                        | File                    | Notes                                     |
| --------------------------- | ----------------------- | ----------------------------------------- |
| Education hub               | `page.tsx`              | Entry page for education administration   |
| Content/material management | `materials/page.tsx`    | Course/material CRUD patterns             |
| Quiz management             | `quizzes/page.tsx`      | Quiz lifecycle and question flows         |
| Detail views                | `quizzes/[id]/page.tsx` | Inspect and update specific quiz entities |

## CONVENTIONS

- Keep content and quiz flows separated but navigable via shared tabs/links.
- Use hooks as the only API boundary for mutations and queries.
- Preserve validation/UI error feedback for multi-step content forms.
- Keep list/detail pages consistent in status labeling.

## ANTI-PATTERNS

- No question/content schema duplication inside pages.
- No direct API calls from modal/form components.
- No silent publish/unpublish actions without explicit confirmation UI state.
