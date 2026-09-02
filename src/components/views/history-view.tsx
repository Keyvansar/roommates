'use client'

import { useMemo, useState } from 'react'
import {
  Flag,
  History,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Trash,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { LogEditDialog } from '@/components/log-edit-dialog'
import { TierBadge } from '@/components/badges'
import {
  useDeleteLog,
  useLogs,
  useProfiles,
} from '@/hooks/use-data'
import { useFlagLog, useRestoreLog } from '@/hooks/use-moderation'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useUserStore } from '@/lib/store'
import { formatJalaliDate, formatRelativeFa, formatTimeFa } from '@/lib/jalali'
import type { PurchaseLogDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

const MAX_REASON = 500

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

/** Stable day key in Gregorian yyyy-MM-dd — used purely for grouping. */
function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/* ------------------------------ Header card ------------------------------- */

function HeaderCard({
  count,
  totalPoints,
  showTrash,
  canToggleTrash,
  onToggleTrash,
}: {
  count: number
  totalPoints: number
  showTrash: boolean
  canToggleTrash: boolean
  onToggleTrash: () => void
}) {
  const fa = useFaDigits()
  return (
    <Card className="border-0 overflow-hidden py-0">
      <div className="bg-gradient-to-bl from-emerald-500/15 via-emerald-500/10 to-amber-500/15 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="bg-emerald-500/20 text-emerald-700 flex size-11 shrink-0 items-center justify-center rounded-xl dark:text-emerald-300"
          >
            <History className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums leading-none">{fa(count)}</span>
              <span className="text-muted-foreground text-sm">خرید ثبت‌شده</span>
            </div>
            <div className="text-muted-foreground mt-1 text-xs tabular-nums">
              مجموع <span className="text-foreground font-medium">{fa(totalPoints)}</span> امتیاز
            </div>
          </div>
          {canToggleTrash && (
            <Button
              type="button"
              variant={showTrash ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleTrash}
              aria-pressed={showTrash}
              className={cn('shrink-0 gap-1.5', showTrash && 'bg-amber-600 hover:bg-amber-600/90')}
            >
              {showTrash ? <Trash className="size-4" /> : <Trash2 className="size-4" />}
              <span className="hidden sm:inline">{showTrash ? 'بستن سطل' : 'سطل بازیافت'}</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function TrashBanner() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300"
    >
      <ShieldAlert className="size-4 shrink-0" aria-hidden />
      <span className="text-xs leading-tight">
        حالت بازیافت فعال — رکوردهای حذف‌شده همراه با گزینه‌ی بازیابی نمایش می‌شوند.
      </span>
    </div>
  )
}

/* --------------------------- Buyer filter chips --------------------------- */

function BuyerChips({
  profiles,
  active,
  onChange,
  counts,
}: {
  profiles: { id: string; name: string; avatarColor: string }[]
  active: string | 'all'
  onChange: (id: string | 'all') => void
  counts: Record<string, number>
}) {
  const fa = useFaDigits()
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange('all')}
        aria-pressed={active === 'all'}
        className={cn(
          'tap-scale flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          active === 'all'
            ? 'border-transparent bg-foreground text-background'
            : 'border-border bg-card hover:bg-accent/40',
        )}
      >
        <span>همه</span>
        <span className={cn('tabular-nums', active === 'all' ? 'text-background/85' : 'text-muted-foreground')}>
          {fa(counts.all ?? 0)}
        </span>
      </button>
      {profiles.map((p) => {
        const isActive = active === p.id
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={isActive}
            className={cn(
              'tap-scale flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'border-transparent text-white'
                : 'border-border bg-card hover:bg-accent/40',
            )}
            style={isActive ? { backgroundColor: p.avatarColor } : undefined}
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.85)' : p.avatarColor }}
            />
            <span>{p.name}</span>
            <span className={cn('tabular-nums', isActive ? 'text-white/85' : 'text-muted-foreground')}>
              {fa(counts[p.id] ?? 0)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ Flag dialog ------------------------------- */

function FlagDialog({
  log,
  open,
  onOpenChange,
}: {
  log: PurchaseLogDTO | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const flag = useFlagLog()
  const fa = useFaDigits()
  const [reason, setReason] = useState('')
  const isOwn = useUserStore((s) => s.activeProfile?.id === log?.buyerId)

  // Reset the textarea each time the dialog opens for a fresh log.
  const [lastLogId, setLastLogId] = useState<string | null>(null)
  if (open && log && log.id !== lastLogId) {
    setReason('')
    setLastLogId(log.id)
  }

  const handleSubmit = () => {
    if (!log) return
    const trimmed = reason.trim()
    if (!trimmed) return
    flag.mutate(
      { id: log.id, reason: trimmed },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="text-amber-600 size-5 dark:text-amber-400" />
            گزارش خرید
          </DialogTitle>
          <DialogDescription>
            اگر این خرید اشتباه ثبت شده یا مشکلی دارد، برای مدیران توضیح دهید.
          </DialogDescription>
        </DialogHeader>

        {!log ? null : isOwn ? (
          <p className="text-destructive text-sm">
            نمی‌توانید خرید خودتان را گزارش دهید.
          </p>
        ) : (
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              placeholder="دلیل گزارش (حداکثر ۵۰۰ کاراکتر)…"
              rows={4}
              maxLength={MAX_REASON}
              disabled={flag.isPending}
            />
            <div className="text-muted-foreground flex justify-end text-xs tabular-nums">
              {fa(reason.length)} / {fa(MAX_REASON)}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-stretch">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">انصراف</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={flag.isPending || isOwn || !reason.trim()}
            className="flex-1 gap-1.5"
          >
            <Flag className="size-4" />
            {flag.isPending ? 'در حال ثبت…' : 'ثبت گزارش'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Log row ---------------------------------- */

function LogRow({
  log,
  onFlag,
  onEdit,
  isOwner,
  activeProfileId,
}: {
  log: PurchaseLogDTO
  onFlag: (log: PurchaseLogDTO) => void
  onEdit: (log: PurchaseLogDTO) => void
  isOwner: boolean
  activeProfileId: string | null
}) {
  const fa = useFaDigits()
  const del = useDeleteLog()
  const restore = useRestoreLog()
  const [softOpen, setSoftOpen] = useState(false)
  const [hardOpen, setHardOpen] = useState(false)

  const isDeleted = !!log.deletedAt
  const isFlagged = log.status === 'flagged'
  const isSelf = activeProfileId === log.buyerId

  return (
    <div
      className={cn(
        'bg-card flex items-start gap-2.5 rounded-xl border p-3',
        isDeleted && 'opacity-60',
      )}
    >
      <div
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: log.buyerColor }}
      >
        {profileInitial(log.buyerName)}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate font-medium leading-tight',
              isDeleted && 'line-through',
            )}
          >
            {log.itemTitle}
          </span>
          {isFlagged && !isDeleted && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0 gap-1">
              <Flag className="size-3" />
              گزارش
            </Badge>
          )}
          {isDeleted && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground shrink-0">
              حذف‌شده
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={log.pointTier} />
          <span className="bg-emerald-500/15 text-emerald-700 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums dark:text-emerald-300">
            +{fa(log.pointsAwarded)}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatTimeFa(log.purchasedAt)} · {formatRelativeFa(log.purchasedAt)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-0.5">
        {isDeleted ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`بازیابی ${log.itemTitle}`}
              onClick={() => restore.mutate(log.id)}
              disabled={restore.isPending && restore.variables === log.id}
            >
              <RotateCcw className="size-4" />
            </Button>
            {isOwner && (
              <AlertDialog open={hardOpen} onOpenChange={setHardOpen}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive size-8"
                  aria-label={`حذف کامل ${log.itemTitle}`}
                  asChild
                >
                  <button type="button">
                    <Trash2 className="size-4" />
                  </button>
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف کامل رکورد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      این عمل برگشت‌ناپذیر است و رکورد برای همیشه از تاریخچه حذف می‌شود.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => del.mutate({ id: log.id, hard: true })}
                    >
                      بله، حذف کامل
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`گزارش خرید ${log.itemTitle}`}
              onClick={() => onFlag(log)}
              disabled={isSelf}
              title={isSelf ? 'نمی‌توانید خرید خودتان را گزارش دهید' : 'گزارش به مدیران'}
            >
              <span aria-hidden className="text-base leading-none">🚩</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={`ویرایش ${log.itemTitle}`}
              onClick={() => onEdit(log)}
            >
              <Pencil className="size-4" />
            </Button>
            <AlertDialog open={softOpen} onOpenChange={setSoftOpen}>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive size-8"
                aria-label={`حذف ${log.itemTitle}`}
                asChild
              >
                <button type="button">
                  <Trash2 className="size-4" />
                </button>
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف این خرید؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    رکورد به‌صورت موقت حذف می‌شود و برای ۷ روز قابل بازیابی است.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => del.mutate(log.id)}
                  >
                    بله، حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ Day group -------------------------------- */

function DayGroup({
  dayLabel,
  logs,
  onFlag,
  onEdit,
  isOwner,
  activeProfileId,
}: {
  dayLabel: string
  logs: PurchaseLogDTO[]
  onFlag: (log: PurchaseLogDTO) => void
  onEdit: (log: PurchaseLogDTO) => void
  isOwner: boolean
  activeProfileId: string | null
}) {
  const fa = useFaDigits()
  return (
    <section className="space-y-2">
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-10 -mx-1 rounded-md px-1 py-1.5 backdrop-blur">
        <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-medium">
          <span>{dayLabel}</span>
          <span className="tabular-nums">{fa(logs.length)} خرید</span>
        </div>
      </div>
      {logs.map((log) => (
        <LogRow
          key={log.id}
          log={log}
          onFlag={onFlag}
          onEdit={onEdit}
          isOwner={isOwner}
          activeProfileId={activeProfileId}
        />
      ))}
    </section>
  )
}

/* ------------------------------ Empty state ------------------------------- */

function EmptyState({ showTrash }: { showTrash: boolean }) {
  return (
    <Card className="py-6">
      <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
        >
          <History className="size-7" />
        </span>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">
            {showTrash ? 'سطل بازیافت خالی است' : 'هنوز خریدی ثبت نشده'}
          </h3>
          <p className="text-muted-foreground text-sm">
            {showTrash
              ? 'هیچ رکورد حذف‌شده‌ای برای بازیابی وجود ندارد.'
              : 'خریدهای ثبت‌شده در این صفحه به‌ترتیب زمان نمایش داده می‌شوند.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------- History view ----------------------------- */

/**
 * Purchase history. Renders a header card (with count + total points and an
 * OWNER-only toggle for the trash bin view), an amber banner when the trash
 * bin is active, a row of buyer filter chips, then logs grouped by Jalali
 * date with sticky day headers. Each `LogRow` shows the buyer avatar, item
 * title (strikethrough when deleted), tier badge, points pill, time and
 * relative time, plus action buttons: flag + edit + soft-delete for active
 * logs, restore + hard-delete (OWNER only) for deleted logs. Flagged logs
 * surface a "گزارش" badge; deleted logs an "حذف‌شده" badge. Self-flagging is
 * blocked on the row + in the flag dialog.
 */
export function HistoryView() {
  const role = useUserStore((s) => s.role)
  const activeProfileId = useUserStore((s) => s.activeProfileId)

  const isOwner = role === 'OWNER'
  const [showTrash, setShowTrash] = useState(false)
  const [buyerFilter, setBuyerFilter] = useState<string | 'all'>('all')
  const [flagLog, setFlagLog] = useState<PurchaseLogDTO | null>(null)
  const [flagOpen, setFlagOpen] = useState(false)
  const [editLog, setEditLog] = useState<PurchaseLogDTO | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const logsQuery = useLogs(200, showTrash)
  const profilesQuery = useProfiles()

  const logs = logsQuery.data ?? []
  const profiles = profilesQuery.data ?? []

  // Counts per buyer (used in the filter chips). When trash mode is on, the
  // counts include deleted logs too — same scope as the visible list.
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: logs.length }
    for (const l of logs) map[l.buyerId] = (map[l.buyerId] ?? 0) + 1
    return map
  }, [logs])

  const filtered = useMemo(() => {
    if (buyerFilter === 'all') return logs
    return logs.filter((l) => l.buyerId === buyerFilter)
  }, [logs, buyerFilter])

  // Group logs by Jalali day. We use the Gregorian date slice as a stable
  // key and format the heading with `formatJalaliDate` for display.
  const grouped = useMemo(() => {
    const map = new Map<string, PurchaseLogDTO[]>()
    for (const l of filtered) {
      const key = dayKey(l.purchasedAt)
      const list = map.get(key) ?? []
      list.push(l)
      map.set(key, list)
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: formatJalaliDate(key),
      logs: items,
    }))
  }, [filtered])

  const totalPoints = useMemo(
    () => filtered.reduce((s, l) => s + l.pointsAwarded, 0),
    [filtered],
  )

  const handleFlag = (log: PurchaseLogDTO) => {
    setFlagLog(log)
    setFlagOpen(true)
  }

  const handleEdit = (log: PurchaseLogDTO) => {
    setEditLog(log)
    setEditOpen(true)
  }

  if (logsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <HeaderCard
        count={filtered.length}
        totalPoints={totalPoints}
        showTrash={showTrash}
        canToggleTrash={isOwner}
        onToggleTrash={() => setShowTrash((v) => !v)}
      />

      {showTrash && <TrashBanner />}

      {profiles.length > 0 && (
        <BuyerChips
          profiles={profiles}
          active={buyerFilter}
          onChange={setBuyerFilter}
          counts={counts}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState showTrash={showTrash} />
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <DayGroup
              key={g.key}
              dayLabel={g.label}
              logs={g.logs}
              onFlag={handleFlag}
              onEdit={handleEdit}
              isOwner={isOwner}
              activeProfileId={activeProfileId}
            />
          ))}
        </div>
      )}

      <FlagDialog log={flagLog} open={flagOpen} onOpenChange={setFlagOpen} />
      <LogEditDialog log={editLog} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
