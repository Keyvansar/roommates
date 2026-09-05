# REBUILD-HOOKS — general-purpose agent

## Summary

Created all React hooks for the roommates app rebuild under `/home/z/my-project/src/hooks/`.

## Files created

| File | Purpose |
|---|---|
| `src/hooks/use-sync-store.ts` | Zustand store for `connected` + `presence` state used by the realtime hook. |
| `src/hooks/use-data.ts` | Catalog/data queries (`useProfiles`, `useCategories`, `useItems` 20s, `useLogs(limit=200, includeDeleted=false)` with `[...qk.logs,'deleted']` queryKey, `useBalance` 20s, `useStats(range='all')`, `useCategoryStats`, `useBuyerStats`, `useTierStats`, `useWeeklyStats`) and mutations (`useToggleItemStatus`, `useUpdateItem`, `useCheckout` using `useUserStore.activeProfile` + invalidates items/balance + broadcasts checkout, `useUpdateLog`, `useDeleteLog` accepting `string | {id,hard?,reason?}`, `useCreateItem`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `useReseed` invalidating everything). All mutations invalidate the correct queries, `broadcastChange()`, and emit `toast.success`/`toast.error` via `sonner`. |
| `src/hooks/use-auth.ts` | `useMe()` (queryKey `['auth','me']`), `useHouseholdSettings(householdId)` (queryKey `['household-settings', id]`), and mutations `useSignup`/`useLogin` (both `setSession` via `useUserStore` + invalidate me + invalidate profiles), `useLogout` (`clearSession` + `qc.clear`), `useCreateHousehold`, `useJoinHousehold`, `useSwitchHousehold` (invalidates me + items + logs + balance + broadcast), `useRegenerateInvite`, `useUpdateProfile`, `useChangePassword`, `useLeaveHousehold`, `useDeleteHousehold`, `useDeleteAccount`, `useUpdateHouseholdSettings`. Exports `authKeys = { me: ['auth','me'] as const }` and `householdSettingsKeys = { detail: (id) => ['household-settings', id] as const }`. |
| `src/hooks/use-moderation.ts` | `useModerationQueue` (queryKey `['moderation','queue']`, 30s refetch), `useModerationAudit(actionType?)` (queryKey `['moderation','audit', actionType]`), and mutations `useFlagLog`, `useApproveLog`, `useRejectLog`, `useResolveLog`, `useRestoreLog`, `useChangeMemberRole`, `useRemoveMember` — all invalidate mod queue + logs + balance + stats + broadcast. Exports `modKeys = { queue: [...], audit: [...] }`. |
| `src/hooks/use-realtime.ts` | `useRealtime()` connects to `getSocket()` from `@/lib/realtime`. Listens for `change` events and invalidates the right query slice based on `payload.type` (items→items+stats, purchase-logs→logs+balance+stats, balance→balance+stats, profiles→profiles+stats). Tracks `connect`/`disconnect` via `useSyncStore` and handles `presence`/`presence-list` events. Emits `join` on connect so others see us. |
| `src/hooks/use-tier-meta.ts` | `useTierMeta()` uses `useHouseholdSettings` + `useUserStore` for household id, merges settings.tierLabels (defaults سبک/متوسط/سنگین) with `TIER_META` points/color from `@/lib/types`. Returns `Record<PointTier, {label, points, color}>`. |
| `src/hooks/use-fa-digits.ts` | `useFaDigits()` uses `useAppearance` from `@/components/appearance-provider`, returns a function `(input: number|string) => string` that converts digits to Persian when `faDigits` is on, Latin otherwise. |
| `src/components/appearance-provider.tsx` | Minimal `AppearanceProvider` + `useAppearance` context that persists `faDigits` to localStorage. Created as a stub so `use-fa-digits` has a stable import path; a future task can extend it. |

## Pre-existing files kept

- `src/hooks/use-mobile.ts` — already existed (`useIsMobile()` via `window.matchMedia('(max-width: 767px)')`). Kept as-is.
- `src/hooks/use-toast.ts` — already existed. Kept as-is.

## Lint status

`cd /home/z/my-project && bun run lint` exits 0 with no warnings or errors.

Pre-existing `tsc` errors in unrelated files (NOT introduced by this task):
- `src/lib/realtime.ts` — `Cannot find module 'socket.io-client'`. The package is not yet listed in `package.json` and `node_modules/socket.io-client` is absent. Once the package is installed these resolve; meanwhile the realtime hook compiles fine because it imports the same already-existing module.
- `examples/websocket/*` and `mini-services/sync-service/index.ts` — pre-existing.
- `skills/*` — pre-existing, ignored by eslint config.

`bunx tsc --noEmit` reports zero errors in `src/hooks/*` and `src/components/appearance-provider.tsx`.

## Notes for downstream agents

- All hooks follow the API surface described in the task; mutations use `toast` from `sonner` and `broadcastChange` from `@/lib/realtime`.
- `useCheckout` pulls `activeProfile` from `useUserStore` so callers don't have to pass `buyerId`.
- `useDeleteLog` accepts either a bare string id (soft delete) or `{id, hard?, reason?}`; soft vs hard is distinguished in toast + broadcast action.
- `appearance-provider.tsx` is intentionally minimal — only `faDigits` plus setters. A future `REBUILD-THEME` / `REBUILD-SETTINGS` task can extend the context with `theme`, `density`, etc. without changing `useFaDigits`.
- The realtime hook re-runs when `activeProfile` changes so that presence `join` is re-emitted after the user switches profiles.
