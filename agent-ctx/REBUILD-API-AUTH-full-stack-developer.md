# REBUILD-API-AUTH — full-stack-developer agent

## Summary
Created all auth, household, profiles, categories, and seed API route files for the roommates (هم‌خانه‌یاب) Next.js 16 app.

## Files created (18 routes)

### Auth (`src/app/api/auth/`)
| File | Method | Purpose |
|---|---|---|
| `signup/route.ts` | POST | Create user (hashPassword, lowercase email, pickColor from `AVATAR_COLORS`). If `inviteCode` present: join existing household as MEMBER (capacity check `MAX=2`, re-pick color based on memberCount). Else create new household (newInviteCode) as OWNER + HouseholdSetting + Profile. Also exports `AVATAR_COLORS` + `pickColor` (reused by `/api/me/profile`). |
| `login/route.ts` | POST | Validate email+password (verifyPassword). Generic 401 message to prevent enumeration. Find first membership for an active household; if user has no household still logs them in with `householdId=null`. |
| `logout/route.ts` | POST | Reads session token, `deleteSession`, `clearSessionCookie`. |
| `me/route.ts` | GET | `getCurrentUser({withHousehold:true})`. Returns user (or null envelope for demo), household, role, profile, `households[]` (all memberships with `isActive` flag + `isOwner` + `role`), `profiles[]` for active household with `userId`/`role`/`isMe`. |

### Households (`src/app/api/households/`)
| File | Method | Purpose |
|---|---|---|
| `route.ts` | POST | Create new household (max 5 owned), auto OWNER membership + HouseholdSetting + Profile. Switch active session. |
| `join/route.ts` | POST | Join via uppercase inviteCode (capacity max 2). If already a member, just switches. Else creates Membership + Profile, switches session. |
| `switch/route.ts` | POST | Verify membership, `createSession` with `activeHouseholdId`, set cookie. |
| `[id]/invite/route.ts` | POST | OWNER/MODERATOR only — verify household matches active; `newInviteCode()`, update household, audit log `invite_regenerate`. |
| `[id]/settings/route.ts` | GET (any member) / PATCH (OWNER/MODERATOR) | GET returns parsed `tierLabels` (JSON) + autoApprove + theme. PATCH validates `tierLabels` keys (1/3/5 only), autoApprove bool, theme ∈ system/light/dark. Upsert HouseholdSetting. Audit log `settings_update`. |
| `[id]/members/[userId]/route.ts` | PATCH (OWNER only) / DELETE (OWNER only) | PATCH: change role MEMBER/MODERATOR, or `transferOwnership:true` atomic 3-row tx (demote self → MEMBER, promote target → OWNER, update household.ownerId). DELETE: reassign target's purchaseLogs + items.lastBoughtBy to OWNER's profile; delete target's flags + profile + membership. Audit logs for both. Refuses OWNER self-removal (use `/leave` instead). |
| `[id]/leave/route.ts` | POST | Non-OWNER leaves: reassign logs to OWNER's profile, delete own profile + flags + membership. Switch session to next household (oldest membership) or null. |
| `[id]/danger/route.ts` | DELETE | OWNER permanently deletes household (cascade handled by Prisma). Switch session to next remaining household or null. |

### Me (`src/app/api/me/`)
| File | Method | Purpose |
|---|---|---|
| `profile/route.ts` | PATCH | Update name, avatarColor (validated against `AVATAR_COLORS`), avatarEmoji (max 4 chars or null). Password change requires `currentPassword` (verifyPassword) + new `minLength 6` (hashPassword). Mirror name/color/emoji into active household's Profile if present. |
| `account/route.ts` | DELETE | Requires body `{confirm:'DELETE'}`. Transaction: for each non-owned household — reassign logs/items to OWNER profile, delete flags+profile; delete owned households (cascade); delete memberships/sessions/moderationActions; delete user. Clear cookie. |

### Profiles, Categories, Seed
| File | Method | Purpose |
|---|---|---|
| `profiles/route.ts` | GET | If household: profiles for active household. Else (demo): profiles with `householdId=null`. Returns `{id, name, avatarColor, pin}`. |
| `categories/route.ts` | GET (anon ok) / POST (auth required) | GET: categories for active household (or demo null). POST: create category in active household, auto sortOrder (max+1). Falls back to demo scope if no active household. |
| `categories/[id]/route.ts` | PATCH (auth) / DELETE (auth) | PATCH: rename/icon/reorder. Auto-attaches demo categories (householdId null) to active household when edited. DELETE: refuse if last category in scope; move items to `body.moveTo` or first remaining sibling. |
| `seed/route.ts` | POST | Requires body `{confirm:true}`. If logged in: `seedCatalogForHousehold(active household)`. Else (demo): `seedDatabase()` global. Returns `{ok, scope}`. |

## Patterns used
- All routes: `export const dynamic = 'force-dynamic'` and `import { NextRequest, NextResponse } from 'next/server'`.
- Dynamic routes use the Next.js 16 awaited params pattern: `{ params }: { params: Promise<{ id: string }> }` then `const { id } = await params`.
- All auth via `getCurrentUser({withHousehold: true})` from `@/lib/auth`.
- DB writes via `db` from `@/lib/db`.
- Cross-route exports: `AVATAR_COLORS` + `pickColor` are exported from `signup/route.ts` and imported by `/api/me/profile`.
- Audit logging: `db.moderationAction.create` for invite regenerate, settings update, role change, ownership transfer, member remove.

## Lint status
`cd /home/z/my-project && bun run lint 2>&1 | tail -20` → exit 0, no warnings or errors.

## TypeScript check
`bunx tsc --noEmit` reports zero errors in any of the new `src/app/api/**` files. Pre-existing unrelated errors (not from this task):
- `examples/websocket/*` and `src/lib/realtime.ts` — missing `socket.io-client` (package not yet installed).
- `mini-services/sync-service/index.ts` — pre-existing.
- `skills/*` — pre-existing, ignored by eslint config.
- `src/app/page.tsx` — references `@/components/app-shell` which is a future (REBUILD-FRONTEND) task.

## Notes for downstream agents
- `AVATAR_COLORS` lives in `src/app/api/auth/signup/route.ts` and is exported for re-use; if a future task centralizes constants, move it to `@/lib/constants` and update both imports.
- The settings PATCH validates `tierLabels` keys against `['1','3','5']` only; unknown keys are dropped silently rather than rejected — frontend should already restrict the picker.
- Member removal flow preserves all `purchaseLog` rows (reassigned by `buyerId`), and `Item.lastBoughtById` is also reassigned so the dashboard's "last bought by" badge never dangles.
- Account deletion is fully transactional; the order is: (per-household reassignment) → (delete owned households via cascade) → (delete remaining memberships) → (delete sessions + moderation actions) → (delete user). Owned households cascade-clean their own memberships/profiles/items/logs.
- Seed endpoint chooses scope automatically based on session — anonymous calls reset the demo catalog, logged-in calls reset only the active household (preserving users/profiles/memberships per `seedCatalogForHousehold` contract).
- The categories DELETE endpoint refuses to delete the last category in scope; the API client (`api.deleteCategory`) already supports `moveTo` so the frontend can pass an explicit destination when needed.
