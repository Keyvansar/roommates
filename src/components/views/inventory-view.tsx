'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  MoreHorizontal,
  PackageSearch,
  Plus,
  Search,
  ShoppingCart,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AddItemSheet } from '@/components/add-item-sheet'
import { CategoryIcon } from '@/components/category-icon'
import { StatusBadge, TierBadge } from '@/components/badges'
import {
  useCategories,
  useItems,
  useToggleItemStatus,
  useUpdateItem,
} from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import { formatRelativeFa } from '@/lib/jalali'
import {
  STATUS_META,
  type CategoryDTO,
  type ItemDTO,
  type ItemStatus,
  type PointTier,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | ItemStatus

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'in_stock', label: 'موجود' },
  { key: 'depleted', label: 'تمام‌شده' },
  { key: 'in_cart', label: 'در سبد' },
]

const ITEM_STATUSES: ItemStatus[] = ['in_stock', 'depleted', 'in_cart']
const TIERS: PointTier[] = [1, 3, 5]

/* ----------------------------- Empty state ------------------------------- */

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  action?: React.ReactNode
}) {
  return (
    <Card className="py-6">
      <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
        >
          {icon}
        </span>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-muted-foreground text-sm">{hint}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Item tile --------------------------------- */

function ItemTile({ item }: { item: ItemDTO }) {
  const toggle = useToggleItemStatus()
  const update = useUpdateItem()
  const tierMeta = useTierMeta()

  const handleToggle = () => {
    // Tap toggles between depleted <-> in_stock only; in_cart stays as-is
    // (it has its own semantics handled via the overflow menu).
    const next: ItemStatus = item.status === 'depleted' ? 'in_stock' : 'depleted'
    toggle.mutate({ id: item.id, status: next })
  }

  const statusColor = STATUS_META[item.status].color

  return (
    <div className="bg-card flex items-start gap-2 rounded-xl border p-3">
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggle.isPending && toggle.variables?.id === item.id}
        aria-label={
          item.status === 'depleted'
            ? `علامت‌گذاری ${item.title} به‌عنوان موجود`
            : `علامت‌گذاری ${item.title} به‌عنوان تمام‌شده`
        }
        className="tap-scale flex flex-1 items-start gap-3 text-right disabled:opacity-50"
      >
        <span
          aria-hidden
          className="mt-1 inline-block size-3 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: statusColor }}
        />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="font-medium leading-tight">{item.title}</span>
          <span className="flex flex-wrap gap-1.5">
            <TierBadge tier={item.pointTier} />
            <StatusBadge status={item.status} />
          </span>
          {item.lastBoughtAt && (
            <span className="text-muted-foreground text-xs leading-tight">
              آخرین خرید: {item.lastBoughtByName ?? '—'} · {formatRelativeFa(item.lastBoughtAt)}
            </span>
          )}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`تنظیمات ${item.title}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>تغییر وضعیت</DropdownMenuLabel>
          {ITEM_STATUSES.map((s) => (
            <DropdownMenuItem
              key={s}
              disabled={s === item.status}
              onClick={() => update.mutate({ id: item.id, status: s })}
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: STATUS_META[s].color }}
              />
              <span>{STATUS_META[s].label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>تیر امتیاز</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(item.pointTier)}
            onValueChange={(v) =>
              update.mutate({ id: item.id, pointTier: Number(v) as PointTier })
            }
          >
            {TIERS.map((t) => (
              <DropdownMenuRadioItem key={t} value={String(t)}>
                {tierMeta[t].label} · {tierMeta[t].points} امتیاز
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* --------------------------- Category card -------------------------------- */

function CategoryCard({
  category,
  items,
  onAddInCategory,
}: {
  category: CategoryDTO
  items: ItemDTO[]
  onAddInCategory: () => void
}) {
  const fa = useFaDigits()
  const [open, setOpen] = useState(true)
  const depletedCount = items.filter((i) => i.status === 'depleted').length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
    <Card className="overflow-hidden py-0">
      <div className="flex items-center gap-2 p-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="tap-scale flex flex-1 items-center gap-3 text-right"
            aria-label={open ? `بستن دسته ${category.title}` : `باز کردن دسته ${category.title}`}
          >
            <span
              aria-hidden
              className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"
            >
              <CategoryIcon name={category.icon} size={18} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-medium leading-tight">{category.title}</span>
              <span className="text-muted-foreground text-xs leading-tight">
                {fa(items.length)} کالا
                {depletedCount > 0 ? ` · ${fa(depletedCount)} تمام‌شده` : ''}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onAddInCategory}
          aria-label={`افزودن کالا به دسته ${category.title}`}
        >
          <Plus />
        </Button>
      </div>
      <CollapsibleContent>
        <div className="border-t p-3 pt-3">
          <div className="space-y-2">
            {items.map((it) => (
              <ItemTile key={it.id} item={it} />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Card>
    </Collapsible>
  )
}

/* --------------------------- Inventory view ------------------------------- */

/**
 * Full inventory of household items. Renders a search row (with an Add
 * button), two summary pill chips (total items + depleted count), a row of
 * color-coded status filter chips, then a stack of collapsible category
 * cards. Each card holds the category's items as `ItemTile`s that toggle
 * depleted ↔ in-stock on tap and expose an overflow menu for status/tier
 * changes. Two empty states are handled: no items at all, and no items
 * matching the current search/filter.
 */
export function InventoryView() {
  const itemsQuery = useItems()
  const categoriesQuery = useCategories()
  const fa = useFaDigits()

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | undefined>(undefined)

  const items = itemsQuery.data ?? []
  const categories = categoriesQuery.data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => {
      if (filter !== 'all' && i.status !== filter) return false
      if (q && !i.title.toLowerCase().includes(q) && !i.categoryTitle.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, filter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, ItemDTO[]>()
    for (const it of filtered) {
      const list = map.get(it.categoryId) ?? []
      list.push(it)
      map.set(it.categoryId, list)
    }
    return categories
      .map((c) => ({ category: c, items: map.get(c.id) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [filtered, categories])

  const totalItems = items.length
  const depletedCount = items.filter((i) => i.status === 'depleted').length

  const openAddSheet = (categoryId?: string) => {
    setDefaultCategoryId(categoryId)
    setSheetOpen(true)
  }

  if (itemsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <>
        <EmptyState
          icon={<PackageSearch className="size-7" />}
          title="هنوز کالایی ثبت نشده"
          hint="اولین کالای خانه را اضافه کنید تا موجودی شکل بگیرد."
          action={
            <Button onClick={() => openAddSheet()} className="gap-1.5">
              <Plus className="size-4" /> افزودن کالا
            </Button>
          }
        />
        <AddItemSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          defaultCategoryId={defaultCategoryId}
        />
      </>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search + add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2"
          />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی کالا یا دسته…"
            className="pr-9"
            aria-label="جستجوی کالا"
          />
        </div>
        <Button
          onClick={() => openAddSheet()}
          size="icon"
          aria-label="افزودن کالا"
        >
          <Plus />
        </Button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-muted px-3 py-1 rounded-full">
          مجموع: <span className="tabular-nums font-medium">{fa(totalItems)}</span> کالا
        </span>
        <span
          className={cn(
            'rounded-full px-3 py-1',
            depletedCount > 0
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <ShoppingCart className="ml-1 inline size-3 align-middle" aria-hidden />
          <span className="tabular-nums font-medium">{fa(depletedCount)}</span> تمام‌شده
        </span>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <StatusChip
            key={s.key}
            label={s.label}
            count={
              s.key === 'all' ? items.length : items.filter((i) => i.status === s.key).length
            }
            color={s.key === 'all' ? null : STATUS_META[s.key].color}
            active={filter === s.key}
            onClick={() => setFilter(s.key)}
          />
        ))}
      </div>

      {/* Grouped list / no-results */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<Search className="size-7" />}
          title="موردی یافت نشد"
          hint="فیلتر یا جستجو را تغییر دهید."
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ category, items: catItems }) => (
            <CategoryCard
              key={category.id}
              category={category}
              items={catItems}
              onAddInCategory={() => openAddSheet(category.id)}
            />
          ))}
        </div>
      )}

      <AddItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultCategoryId={defaultCategoryId}
      />
    </div>
  )
}

/* ----------------------------- StatusChip --------------------------------- */

/**
 * Color-coded status filter chip. The `color` is null for the "all" filter
 * (rendered as a neutral chip). When `active`, the chip inverts to white
 * text on the status color; otherwise it renders as a card-coloured pill
 * with a colored dot and the live item count.
 */
function StatusChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color: string | null
  active: boolean
  onClick: () => void
}) {
  const fa = useFaDigits()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'tap-scale flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-transparent text-white'
          : 'border-border bg-card hover:bg-accent/40',
      )}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {color && (
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: active ? 'rgba(255,255,255,0.85)' : color }}
        />
      )}
      <span>{label}</span>
      <span
        className={cn(
          'tabular-nums',
          active ? 'text-white/85' : 'text-muted-foreground',
        )}
      >
        {fa(count)}
      </span>
    </button>
  )
}
