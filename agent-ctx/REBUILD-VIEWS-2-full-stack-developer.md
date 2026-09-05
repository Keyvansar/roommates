# Task ID: REBUILD-VIEWS-2
**Agent:** full-stack-developer
**Task:** Create history, moderation, settings views for roommates app rebuild.

## Work Log

### Files created
- `src/components/views/history-view.tsx` (~660 lines)
- `src/components/views/moderation-view.tsx` (~470 lines)
- `src/components/views/settings-view.tsx` (~1150 lines)

### Supporting change
- `src/app/api/auth/signup/route.ts`: extended `AVATAR_COLORS` from 8 → 12 colors (added cyan-600 / orange-600 / purple-600 / yellow-600) so the settings color picker's full 12-color palette passes the backend `AVATAR_COLORS.includes()` validation. Additive change — existing user colors remain valid.

### history-view.tsx
- `HeaderCard` — gradient emerald→amber tile, History icon, count + total points, OWNER-only Trash/Trash2 toggle button with amber-tinted active style.
- `TrashBanner` — amber, ShieldAlert icon + status text. Rendered only when `showTrash` is on.
- `BuyerChips` — "all" + each profile chip with colored dot + live count; active chip inverts to white-on-color via inline style.
- `DayGroup` — sticky `top-14` day header (label + count) followed by `LogRow`s, grouped by Gregorian `yyyy-MM-dd` slice + `formatJalaliDate` for display.
- `LogRow` — buyer avatar + item title (line-through when deleted) + TierBadge + emerald `+N points` pill + `formatTimeFa` + `formatRelativeFa` + "گزارش" amber Badge (flagged, not deleted) + "حذف‌شده" muted Badge (deleted) + action buttons.
  - Active logs: 🚩 flag (disabled when `buyerId === activeProfile.id`) + Pencil edit (opens `LogEditDialog`) + Trash2 soft-delete (`AlertDialog`).
  - Deleted logs: `RotateCcw` restore (`useRestoreLog`) + Trash2 hard-delete (OWNER only, `AlertDialog`).
  - Deleted rows render with `opacity-60`.
- `FlagDialog` — Dialog with Textarea (max 500 chars, live fa counter), Flag submit. Self-flagging blocked both on the row button and inside the dialog body via `activeProfile?.id === log?.buyerId`.
- Uses: `useLogs(200, showTrash)`, `useProfiles`, `useDeleteLog`, `useFlagLog`, `useRestoreLog`, `useUserStore`, `useFaDigits`, `formatJalaliDate`, `formatTimeFa`, `formatRelativeFa`. State syncs via the `lastLogId` pattern.

### moderation-view.tsx
- `AccessDenied` — amber UserX tile, shown when role is not MODERATOR/OWNER.
- `HeaderCard` — amber→rose gradient, ShieldCheck tile, role label "مدیر اصلی" / "ناظر".
- Tabs (radix `Tabs`) with "صف بررسی" + "گزارش ممیزی" triggers.
- `QueueTab` — uses `useModerationQueue`; renders `QueueCard`s.
  - `QueueCard` — buyer avatar + item title + buyer name + TierBadge + emerald `+N` pill + amber Flag reason box (🚩 + "دلیل گزارش" + reporter name + reason text) + 3-button grid:
    - تأیید (emerald, `useApproveLog`)
    - رد (red, opens `RejectDialog` with reason Textarea → `useRejectLog`)
    - حل‌وفصل (`useResolveLog`, opens `ResolveDialog` with tier Select using `useTierMeta` + `useFaDigits`; disabled when `!isOwner` with tooltip).
- `AuditTab` — uses `useModerationAudit(filter)`.
  - `AuditFilters` — color-coded filter chips via `ACTION_META` map; active chip inverts to white-on-color.
  - `AuditRow` — color-coded action icon tile + actor avatar + action label + actor name + optional reason box + optional metadata detail (parsed JSON→`k: v` join) + `formatJalaliDateTime` + `formatRelativeFa`.
- `ACTION_META` covers 12 audit types: `log_edit`, `log_delete`, `log_delete_hard`, `log_approve`, `log_reject`, `log_resolve`, `log_restore`, `settings_update`, `role_change`, `ownership_transfer`, `member_remove`, `invite_regenerate`. (Spec said 11 — included all 12 the backend actually emits for completeness.)
- Both tabs have `Skeleton` loaders and friendly empty states.

### settings-view.tsx
- `SettingsView` — gradient header card + 7 `Accordion` items (profile / household / categories / tiers / appearance / notifications / about) on `bg-card` rounded tiles. Uses `type="multiple"` with `defaultValue={['profile']}` so sections stay open independently.
- `ProfileSection`:
  - 16-px avatar preview (color + emoji)
  - Name `Input`
  - 12-color `AVATAR_COLOR_PALETTE` grid (active = ring + Check)
  - 12-emoji `AVATAR_EMOJIS` grid (active = primary border)
  - Save button (dirty when name/color/emoji differ from server, uses `useUpdateProfile`)
  - Change-password form (current + new, min 6 chars, uses `useChangePassword`)
  - Logout button (`useLogout`)
- `HouseholdSection`:
  - When no household → create-household form (`useCreateHousehold`).
  - Else disabled name `Input` + invite code (readonly + Copy button with 1.5s feedback + RefreshCw regenerate for OWNER/MOD via `useRegenerateInvite`).
  - Members list (avatar + name + `RoleBadge` + OWNER-only DropdownMenu with promote-to-MOD / demote-to-MEMBER / transfer-ownership / remove-member via `useChangeMemberRole` + `useRemoveMember`).
- `CategoriesSection`:
  - Add-new form (title `Input` + `IconPicker` grid of 27 `CATEGORY_ICON_LIST` icons + Add button via `useCreateCategory`).
  - List with inline edit (Pencil toggles `IconPicker` + title `Input` + Save/Cancel) + Trash2 delete (`AlertDialog`; uses `useDeleteCategory`; delete disabled when only 1 category remains).
- `TiersSection`:
  - 3 color-coded label `Input`s (uses `useHouseholdSettings` + `useUpdateHouseholdSettings`).
  - Save button (sends `tierLabels: labels`), Reset (sends `tierLabels: null`).
  - Label `Input`s turn colored-border when dirty vs server.
- `AppearanceSection`:
  - 3 theme buttons (light/dark/system via `useTheme` from `next-themes`, mount-gated to avoid hydration mismatch).
  - Persian digits `Switch` (`useAppearance.faDigits` / `setFaDigits`).
  - Compact mode `Switch` (`useAppearance.compact` / `setCompact`).
- `NotificationsSection`:
  - 3 `Switch` toggles (depleted/turn/edit) persisted via `useNotifFlags` inline helper (localStorage `hamkhaneh-notif`).
- `AboutSection`:
  - Version text + reset-catalog `AlertDialog` (`useReseed`).
  - Danger zone:
    - Leave household (non-OWNER, `useLeaveHousehold`)
    - Delete household (OWNER, `AlertDialog` with type-to-confirm matching household name, `useDeleteHousehold`)
    - Delete account (all users, `useDeleteAccount`).

### Lint / type-check
- `bun run lint` exits 0 with no errors and no warnings.
- `bunx tsc --noEmit -p tsconfig.json` reports zero errors in any new `src/components/views/*` file.
- Dev server compiles cleanly and continues serving HTTP 200 at `/`.

## Stage Summary

All 3 tab views (history-view, moderation-view, settings-view) created as self-contained `'use client'` components under `src/components/views/`. Lint and tsc both clean for the new files. The views are ready for downstream wiring into `app-shell.tsx` (replace the labelled placeholder Card in the logged-in branch with `<HistoryView />`, `<ModerationView />`, `<SettingsView />` based on the active `tab` from `useState<TabKey>`). Backend `AVATAR_COLORS` array was also extended from 8 → 12 colors to support the settings profile color picker.
