# REBUILD-VIEWS-INSIGHTS — full-stack-developer agent

## Task
Create the insights (آمار و تحلیل) view for the هم‌خانه‌یاب (roommates) Persian RTL PWA rebuild — the most complex tab view, with 3 drill-down dialogs (category / buyer / tier).

## File created

`/home/z/my-project/src/components/views/insights-view.tsx` — `'use client'`, single-file component, ~960 lines. Built with shadcn/ui `Dialog` + `Card` + `Skeleton`, Tailwind 4 utility classes, and `lucide-react` icons. All numerals are piped through `useFaDigits`; all dates through `formatRelativeFa` from `@/lib/jalali`. RTL Persian throughout.

## InsightsView structure (state + sections)

- **State** (`useState`):
  - `range: 'all' | '3m' | '1m'` (defaults to `'all'`)
  - `drillDownCat: string | null` (categoryId for `CategoryDrillDownDialog`)
  - `drillDownBuyer: string | null` (profileId for `BuyerDrillDownDialog`)
  - `drillDownTier: 1 | 3 | 5 | null` (for `TierDrillDownDialog`)
- **Hooks**: `useStats(range)` (drives the whole view); each drill-down dialog component calls its own `useCategoryStats` / `useBuyerStats` / `useTierStats` with `enabled: !!id` so the queries only fire when the dialog is open. Also `useFaDigits` (via subcomponents) and `useTierMeta` (in `TierDistribution`, `TierCards`, `TierDrillDownDialog`).
- **Loading state**: 5 stacked `Skeleton`s (header / range / KPI / leader / chart) when `statsQuery.isLoading`.
- **Empty state** (`!stats`): centred `BarChart3` tile + "داده‌ای موجود نیست".
- **`hasData = totals.purchases > 0`**: gates the contribution / category / tier / top-items cards (no data → no point rendering empty shells). When `!hasData` a fallback centred card "هنوز خریدی ثبت نشده" replaces them.

## Top-level sections (in order)

1. **`HeaderCard`** — gradient (emerald→amber) hero with `BarChart3` icon tile, "آمار و تحلیل" title, subtitle, and a `<a href="/api/stats/export?range={range}" download>` button with `Download` icon. Range value is interpolated into the URL so the CSV export always matches the active range.
2. **`RangeFilter`** — segmented `role="tablist"` with 3 buttons: ماه اخیر (`1m`) / ۳ ماه (`3m`) / همه (`all`). Active button is `bg-background shadow-sm`, inactive `hover:text-foreground`.
3. **`KpiGrid`** — 2×2 grid of `KpiCard`s, each with a coloured icon chip (12% tint via `hexWithAlpha`) + large 2xl bold number + label:
   - کل خریدها (`ShoppingBag`, emerald) → `totals.purchases`
   - کل امتیاز (`TrendingUp`, amber) → `totals.points`
   - اقلام منحصر (`Package`, indigo) → `totals.items`
   - روزهای فعال (`Calendar`, pink) → `totals.activeDays`
4. **`LeaderCard`** — `Crown` in amber-tinted tile + leader avatar (their color) + name + points + percentage (`{points}/{totalPoints}×100`, fa-formatted). Falls back to muted card with `Crown` + "هنوز خریدی ثبت نشده" when `leader == null`.
5. **`ProfileContribution`** (inside a `Card` titled "سهم هم‌خانه‌ها", only when `hasData`) — list of clickable `button`s, each showing avatar circle (colored), name, count+points, an avatar-colored horizontal progress bar (proportional to totalPoints), and a `ChevronLeft` indicator. Clicking opens `BuyerDrillDownDialog` for that profileId.
6. **`MonthlyTrend`** — hand-rolled inline SVG line+area chart (no chart lib). `viewBox 0 0 320 140`, padding 18px sides / 12px top / 28px bottom. Plots `monthlyTrend[].points` (six Jalali months). Features:
   - 4 horizontal gridlines (`strokeOpacity 0.08`)
   - `<linearGradient id="insights-area">` vertical emerald 0.35→0.02 for area fill
   - `<linearGradient id="insights-line">` horizontal emerald→amber for the line stroke (width 2, round caps)
   - White-fill data point circles (`r=3.5`, emerald stroke) at each month
   - Persian month labels below each point (`d.label`, text-anchor middle, fontSize 10, fill `muted-foreground`)
   - Footer line "بیشینه: N امتیاز · ۶ ماه اخیر" + a centered hint when every month is zero
7. **`CategoryBreakdown`** (Card titled "دسته‌های خرید‌شده", only when `hasData`) — list of clickable buttons, each with `CategoryIcon` tile, title, count+points, primary-colored horizontal progress bar (relative to `maxCategoryPoints`), and `ChevronLeft` indicator. The "بدون دسته" bucket (id `'`) is rendered but `disabled` and lacks the chevron.
8. **`TierDistribution`** (Card titled "توزیع تیرها", only when `hasData`) — 3-column grid of `button`s, one per tier (`TIERS = [1,3,5]`). Tier-coloured (via `useTierMeta`) with tinted background and border. `disabled` when `count === 0` (`opacity-50`). Otherwise `hover:scale-[1.03] active:scale-[0.98]` for tactile feedback. Clicking opens `TierDrillDownDialog`.
9. **`TopItems`** (Card titled "پرتکرارترین اقلام", only when `hasData`) — `<ol>` of ranked items; top 3 use medal colors (`MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#b45309']` gold/silver/bronze) for the rank chip; the rest get slate (#64748b). Each row: rank chip + item title + count/points + last-buyer avatar (colored, with `title` tooltip "آخرین خریدار: X").
10. **`CategoryDrillDownDialog` / `BuyerDrillDownDialog` / `TierDrillDownDialog`** — always mounted (so the `use*Stats` hooks stay consistent), gated by their `open` prop (`!!drillDown*`). `onOpenChange={(v) => !v && setDrillDown*(null)}` so only the closing transition clears state.

## Drill-down dialogs

All three share `className="max-h-[85vh] max-w-md gap-4 overflow-y-auto p-5 scrollbar-thin sm:max-w-md"` on `DialogContent` — Tailwind-merge resolves the `sm:max-w-lg → sm:max-w-md` and `p-6 → p-5` overrides. Each dialog:

- Shows a header block: an icon/avatar tile + `DialogTitle` (truncate) + `DialogDescription` with the totals line (fa-formatted). Falls back to a plain title while loading.
- Renders `<DrillSkeleton />` (4 stacked skeletons: 16/24/24/24) while `query.isLoading`.
- Renders an `EmptyHint` (centred muted text or icon + text) when `!data` or when `totals.purchases === 0`.
- Otherwise renders a `space-y-4` stack of `DialogSection`s, each with a `SectionLabel` ("سهم هم‌خانه‌ها", "دسته‌های خرید‌شده", "پرتکرارترین اقلام", "آخرین خریدها", "توزیع تیرها") and a body component.

### 1. CategoryDrillDownDialog
- Header: `CategoryIcon` tile (from `data.category.icon`) + title + totals (`purchases · points · items`).
- Sections:
  - "سهم هم‌خانه‌ها" → `BuyerBars` (avatar + name + count/points + colored progress bar per buyer).
  - "پرتکرارترین اقلام" → `RankedItemsCategory` (scrollable `max-h-64 overflow-y-auto scrollbar-thin`, ranked list with last-buyer avatar + `formatRelativeFa` of `lastAt`).
  - "آخرین خریدها" → `RecentLogsCategory` (buyer avatar + item title + `TierBadge` + relative time).
- Empty state: `Package` icon + "در این بازه خریدی در این دسته ثبت نشده است."

### 2. BuyerDrillDownDialog
- Header: avatar (buyer color) + name + totals (`purchases · points · categories`).
- Sections:
  - "دسته‌های خرید‌شده" → `CategoryBars` (per-category bars coloured with the buyer's own `avatarColor`).
  - "توزیع تیرها" → `TierCards` (3-column grid of tier-coloured cards, count + points).
  - "پرتکرارترین اقلام" → `TopItemsBuyer` (scrollable, with `categoryTitle` subtitle on each row).
  - "آخرین خریدها" → `RecentLogsBuyer` (with `TierBadge` leading, title + category subtitle, +points pill, relative time).
- Empty state: `ShoppingBag` icon + "در این بازه خریدی از این هم‌خانه ثبت نشده است."

### 3. TierDrillDownDialog
- Header: tinted `Crown` tile in the tier color + "تیر X" (X = tier label from `useTierMeta`) + totals (`purchases · points · items`).
- Sections:
  - "سهم هم‌خانه‌ها" → `BuyerBars` (per-buyer bars).
  - "دسته‌های خرید‌شده" → `CategoryListTier` (scrollable, with `CategoryIcon` tiles + count/points).
  - "پرتکرارترین اقلام" → `TopItemsTier` (scrollable, with `categoryTitle` subtitle + last-buyer avatar + relative time).
  - "آخرین خریدها" → `RecentLogsTier` (buyer avatar + item title + category subtitle + +points pill + relative time).
- Empty state: `Package` icon + "در این بازه خریدی در این تیر ثبت نشده است."

## Shared helper components (in the same file)

- `SectionLabel`, `EmptyHint`, `DialogSection` — small layout primitives.
- `profileInitial(name)`, `hexWithAlpha(hex, alpha)` — utilities reused from `balance-view.tsx` / `to-buy-view.tsx`.
- `DrillSkeleton` — 4-row skeleton placeholder used by all 3 dialogs.
- `BuyerBars` — reused by `CategoryDrillDown` and `TierDrillDown` (per-buyer contribution bars with avatar circles + colored progress).
- `CategoryBars` — buyer-coloured category bars (used in `BuyerDrillDown`).
- `TierCards` — tier-coloured cards (used in `BuyerDrillDown`).
- `CategoryListTier` — scrollable category list with icons (used in `TierDrillDown`).
- `RankedItemsCategory`, `TopItemsBuyer`, `TopItemsTier` — three ranked-item list variants.
- `RecentLogsCategory`, `RecentLogsBuyer`, `RecentLogsTier` — three recent-log list variants (each tailoring the avatar/tier/category columns to what the underlying API returns).
- `KpiCard`, `KpiGrid`, `HeaderCard`, `RangeFilter`, `LeaderCard`, `ProfileContribution`, `MonthlyTrend`, `CategoryBreakdown`, `TierDistribution`, `TopItems` — view-only sections.

## Constants

- `RANGE_OPTIONS = [{key:'1m',label:'ماه اخیر'}, {key:'3m',label:'۳ ماه'}, {key:'all',label:'همه'}]`
- `TIERS = [1, 3, 5]` (iteration order matters for `TierDistribution` and `TierCards` so light → heavy is left-to-right, matching the visual hierarchy)
- `MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#b45309']` (gold / silver / bronze) for the top-items rank chips

## Data shapes consumed (from `use-data.ts` and `lib/api.ts`)

- `useStats(range)` → `{ totals: {purchases, points, items, activeDays}, perProfile: [{id,name,avatarColor,count,points}], perCategory: [{id,title,icon,count,points}], perTier: [{tier,count,points}], monthlyTrend: [{key,label,count,points}], topItems: [{itemTitle,count,points,buyerName,buyerColor}] }`
- `useCategoryStats(categoryId, range)` → `{ category: {id,title,icon}, totals: {purchases, points, items}, perItem: [{itemTitle,count,points,lastBuyer,lastBuyerColor,lastAt}], perBuyer: [{name,avatarColor,count,points}], recentLogs: [{id,itemTitle,buyerName,buyerColor,pointTier,pointsAwarded,purchasedAt}] }`
- `useBuyerStats(profileId, range)` → `{ profile: {id,name,avatarColor,avatarEmoji}, totals: {purchases, points, categories}, perCategory: [{id,title,icon,count,points}], perItem: [{itemTitle,count,points,categoryTitle,lastAt}], perTier: [{tier,count,points}], recentLogs: [{id,itemTitle,pointTier,pointsAwarded,purchasedAt,categoryTitle}] }`
- `useTierStats(tier, range)` → `{ tier, totals: {purchases, points, items}, perBuyer: [{name,avatarColor,count,points}], perCategory: [{id,title,icon,count,points}], perItem: [{itemTitle,count,points,categoryTitle,lastBuyer,lastBuyerColor,lastAt}], recentLogs: [{id,itemTitle,buyerName,buyerColor,pointsAwarded,purchasedAt,categoryTitle}] }`

All `pointTier` values are cast to `PointTier` (`1 | 3 | 5`) at the call site of `TierBadge` since the stats API returns them as plain `number`.

## Lint / type status

- `bun run lint` → exits 0 with **no errors and no warnings**.
- `bunx tsc --noEmit` → zero errors in `src/components/views/insights-view.tsx`. Only pre-existing unrelated errors remain (in `examples/`, `mini-services/sync-service/`, `skills/` directories — same as previously reported by other agents).
- Dev server compiles cleanly (HTTP 200 on `/`).

## Notes for downstream agents

- This view is **not yet wired into `app-shell.tsx`**. To wire it in, find the placeholder Card in the logged-in branch of `app-shell.tsx` (where `TAB_LABELS` is referenced) and replace the `insights` case with `<InsightsView />`. Import from `@/components/views/insights-view`.
- The CSV export link uses a relative `/api/stats/export?range={range}` URL and relies on the browser `<a download>` behaviour — no fetch needed; the route already returns `Content-Disposition: attachment`.
- The dialog content scrolls internally (`max-h-[85vh] overflow-y-auto`) so the header is NOT sticky; the user can scroll the whole dialog body. If a sticky header is desired, wrap the header in `sticky top-0 bg-background z-10 -mx-5 px-5 pb-2` (left/right negative margins cancel the `p-5` padding to allow full-width background).
- All `TierBadge` instances honour the household-level tier label override via `useTierMeta` automatically.
- The SVG chart is responsive (`w-full h-auto`) — it scales with the card width. Gridlines use `currentColor` with low opacity so they adapt to dark mode.
