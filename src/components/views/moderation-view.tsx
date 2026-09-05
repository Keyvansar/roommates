'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  ClipboardList,
  Crown,
  Pencil,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Trash,
  Trash2,
  UserCog,
  UserMinus,
  UserX,
  Wrench,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TierBadge } from '@/components/badges'
import {
  useApproveLog,
  useModerationAudit,
  useModerationQueue,
  useRejectLog,
  useResolveLog,
} from '@/hooks/use-moderation'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import { useUserStore } from '@/lib/store'
import { formatJalaliDateTime, formatRelativeFa } from '@/lib/jalali'
import type { PointTier } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------------------- Helpers ---------------------------------- */

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

/** Shape of a single moderation queue flag (from /api/moderation/queue). */
interface QueueFlag {
  id: string
  purchaseLogId: string
  reporterId: string
  reason: string
  status: string
  createdAt: string
  purchaseLog: {
    id: string
    itemTitle: string
    pointTier: number
    pointsAwarded: number
    purchasedAt: string
    status: string
    deletedAt: string | null
    buyer: { id: string; name: string; avatarColor: string } | null
  } | null
  reporter: { id: string; name: string; avatarColor: string } | null
}

/** Shape of a single audit row (from /api/moderation/audit). */
interface AuditAction {
  id: string
  actionType: string
  actorId: string
  actor: { id: string; name: string; avatarColor: string; avatarEmoji: string | null }
  targetType: string
  targetId: string | null
  reason: string | null
  metadata: string | null
  createdAt: string
  purchaseLogId: string | null
}

/* ----------------------- Action-type metadata map ------------------------- */

interface ActionMeta {
  label: string
  icon: typeof Check
  color: string
}

const ACTION_META: Record<string, ActionMeta> = {
  log_edit: { label: 'ویرایش رکورد', icon: Pencil, color: '#64748b' },
  log_delete: { label: 'حذف موقت', icon: Trash2, color: '#d97706' },
  log_delete_hard: { label: 'حذف کامل', icon: Trash, color: '#dc2626' },
  log_approve: { label: 'تأیید گزارش', icon: Check, color: '#10b981' },
  log_reject: { label: 'رد گزارش', icon: X, color: '#dc2626' },
  log_resolve: { label: 'حل‌وفصل', icon: Wrench, color: '#7c3aed' },
  log_restore: { label: 'بازیابی', icon: RotateCcw, color: '#0d9488' },
  settings_update: { label: 'تغییر تنظیمات', icon: Settings, color: '#64748b' },
  role_change: { label: 'تغییر نقش', icon: UserCog, color: '#d97706' },
  ownership_transfer: { label: 'انتقال مالکیت', icon: Crown, color: '#ca8a04' },
  member_remove: { label: 'حذف عضو', icon: UserMinus, color: '#dc2626' },
  invite_regenerate: { label: 'بازسازی کد دعوت', icon: RefreshCw, color: '#0d9488' },
}

const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'همه' },
  ...Object.entries(ACTION_META).map(([key, m]) => ({ key, label: m.label })),
]

/* ----------------------------- Access denied ------------------------------ */

function AccessDenied() {
  return (
    <Card className="py-6">
      <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
        <span
          aria-hidden
          className="bg-amber-500/15 text-amber-700 flex size-14 items-center justify-center rounded-2xl dark:text-amber-300"
        >
          <UserX className="size-7" />
        </span>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">دسترسی محدود است</h3>
          <p className="text-muted-foreground text-sm">
            این بخش فقط برای ناظر یا مدیر اصلی خانه قابل مشاهده است.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Header card ------------------------------- */

function HeaderCard({ roleLabel }: { roleLabel: string }) {
  return (
    <Card className="border-0 overflow-hidden py-0">
      <div className="bg-gradient-to-bl from-amber-500/15 via-amber-500/10 to-rose-500/15 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="bg-amber-500/20 text-amber-700 flex size-11 shrink-0 items-center justify-center rounded-xl dark:text-amber-300"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-lg font-bold leading-tight">مدیریت و نظارت</h2>
            <p className="text-muted-foreground text-xs leading-tight">
              نقش شما: <span className="text-foreground font-medium">{roleLabel}</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* --------------------------- Reject reason dialog ------------------------- */

function RejectDialog({
  flag,
  open,
  onOpenChange,
}: {
  flag: QueueFlag | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const reject = useRejectLog()
  const [reason, setReason] = useState('')
  const [lastId, setLastId] = useState<string | null>(null)

  if (open && flag && flag.purchaseLogId !== lastId) {
    setReason('')
    setLastId(flag.purchaseLogId)
  }

  const handleSubmit = () => {
    if (!flag) return
    const trimmed = reason.trim()
    if (!trimmed) return
    reject.mutate(
      { id: flag.purchaseLogId, reason: trimmed },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رد گزارش</DialogTitle>
          <DialogDescription>
            دلیل رد این گزارش را برای کاربران توضیح دهید. این رکورد پس از رد به‌صورت موقت حذف می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل رد…"
            rows={4}
            disabled={reject.isPending}
          />
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-stretch">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">انصراف</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={reject.isPending || !reason.trim()}
            className="flex-1 gap-1.5 bg-destructive hover:bg-destructive/90"
          >
            <X className="size-4" />
            {reject.isPending ? 'در حال رد…' : 'رد گزارش'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------- Resolve tier dialog -------------------------- */

function ResolveDialog({
  flag,
  open,
  onOpenChange,
}: {
  flag: QueueFlag | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const resolve = useResolveLog()
  const tierMeta = useTierMeta()
  const fa = useFaDigits()
  const TIERS: PointTier[] = [1, 3, 5]
  const [tier, setTier] = useState<PointTier>(1)
  const [lastId, setLastId] = useState<string | null>(null)

  if (open && flag && flag.purchaseLogId !== lastId) {
    setTier((flag.purchaseLog?.pointTier ?? 1) as PointTier)
    setLastId(flag.purchaseLogId)
  }

  const handleSubmit = () => {
    if (!flag) return
    resolve.mutate(
      { id: flag.purchaseLogId, newTier: tier },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حل‌وفصل گزارش</DialogTitle>
          <DialogDescription>
            تیر امتیاز رکورد را اصلاح کنید. این عمل رکورد را دوباره تأیید و گزارش را می‌بندد.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={String(tier)} onValueChange={(v) => setTier(Number(v) as PointTier)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="انتخاب تیر" />
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: tierMeta[t].color }}
                  />
                  <span>{tierMeta[t].label}</span>
                  <span className="text-muted-foreground tabular-nums">{fa(tierMeta[t].points)} امتیاز</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-stretch">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">انصراف</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={resolve.isPending} className="flex-1 gap-1.5">
            <Wrench className="size-4" />
            {resolve.isPending ? 'در حال حل‌وفصل…' : 'حل‌وفصل'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- Queue card ------------------------------- */

function QueueCard({
  flag,
  isOwner,
  onApprove,
  onReject,
  onResolve,
}: {
  flag: QueueFlag
  isOwner: boolean
  onApprove: (flag: QueueFlag) => void
  onReject: (flag: QueueFlag) => void
  onResolve: (flag: QueueFlag) => void
}) {
  const fa = useFaDigits()
  const approve = useApproveLog()
  const log = flag.purchaseLog
  const buyer = log?.buyer

  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-3">
        {/* Buyer + item */}
        <div className="flex items-start gap-2.5">
          <div
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: buyer?.avatarColor ?? '#6b7280' }}
          >
            {profileInitial(buyer?.name ?? '؟')}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-medium leading-tight">
              {log?.itemTitle ?? '—'}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-xs">{buyer?.name ?? '—'}</span>
              {log && <TierBadge tier={log.pointTier as PointTier} />}
              <span className="bg-emerald-500/15 text-emerald-700 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums dark:text-emerald-300">
                +{fa(log?.pointsAwarded ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Flag reason */}
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
            <span aria-hidden>🚩</span>
            <span>دلیل گزارش</span>
            {flag.reporter && (
              <span className="text-muted-foreground/80">· {flag.reporter.name}</span>
            )}
          </div>
          <p className="mt-1 text-sm leading-snug">{flag.reason}</p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 gap-1"
            onClick={() => onApprove(flag)}
            disabled={approve.isPending && approve.variables?.id === log?.id}
          >
            <Check className="size-4" />
            تأیید
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-300 gap-1"
            onClick={() => onReject(flag)}
          >
            <X className="size-4" />
            رد
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 disabled:opacity-50"
            onClick={() => onResolve(flag)}
            disabled={!isOwner}
            title={isOwner ? 'حل‌وفصل (فقط مدیر اصلی)' : 'حل‌وفصل فقط برای مدیر اصلی'}
          >
            <Wrench className="size-4" />
            حل‌وفصل
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Queue tab --------------------------------- */

function QueueTab({ isOwner }: { isOwner: boolean }) {
  const queueQuery = useModerationQueue()
  const approve = useApproveLog()
  const [rejectFlag, setRejectFlag] = useState<QueueFlag | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [resolveFlag, setResolveFlag] = useState<QueueFlag | null>(null)
  const [resolveOpen, setResolveOpen] = useState(false)

  const flags = (queueQuery.data ?? []) as QueueFlag[]

  const handleApprove = (flag: QueueFlag) => {
    approve.mutate({ id: flag.purchaseLogId })
  }
  const handleReject = (flag: QueueFlag) => {
    setRejectFlag(flag)
    setRejectOpen(true)
  }
  const handleResolve = (flag: QueueFlag) => {
    setResolveFlag(flag)
    setResolveOpen(true)
  }

  if (queueQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (flags.length === 0) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-emerald-500/15 text-emerald-600 flex size-14 items-center justify-center rounded-2xl dark:text-emerald-400"
          >
            <Check className="size-7" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">صف بررسی خالی است</h3>
            <p className="text-muted-foreground text-sm">
              هیچ گزارش بازی برای بررسی وجود ندارد.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <QueueCard
          key={flag.id}
          flag={flag}
          isOwner={isOwner}
          onApprove={handleApprove}
          onReject={handleReject}
          onResolve={handleResolve}
        />
      ))}
      <RejectDialog flag={rejectFlag} open={rejectOpen} onOpenChange={setRejectOpen} />
      <ResolveDialog flag={resolveFlag} open={resolveOpen} onOpenChange={setResolveOpen} />
    </div>
  )
}

/* --------------------------- Audit filter chips -------------------------- */

function AuditFilters({
  active,
  onChange,
  counts,
}: {
  active: string
  onChange: (k: string) => void
  counts: Record<string, number>
}) {
  const fa = useFaDigits()
  return (
    <div className="flex flex-wrap gap-2">
      {ACTION_FILTERS.map((f) => {
        const isActive = active === f.key
        const meta = f.key === 'all' ? null : ACTION_META[f.key]
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            aria-pressed={isActive}
            className={cn(
              'tap-scale flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'border-transparent text-white'
                : 'border-border bg-card hover:bg-accent/40',
            )}
            style={isActive && meta ? { backgroundColor: meta.color } : undefined}
          >
            {meta && (
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.85)' : meta.color }}
              />
            )}
            <span>{f.label}</span>
            <span className={cn('tabular-nums', isActive ? 'text-white/85' : 'text-muted-foreground')}>
              {fa(counts[f.key] ?? 0)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ Audit row -------------------------------- */

function AuditRow({ action }: { action: AuditAction }) {
  const fa = useFaDigits()
  const meta = ACTION_META[action.actionType] ?? {
    label: action.actionType,
    icon: ClipboardList,
    color: '#64748b',
  }
  const Icon = meta.icon

  let metadataText: string | null = null
  if (action.metadata) {
    try {
      const parsed = JSON.parse(action.metadata) as unknown
      if (parsed && typeof parsed === 'object') {
        const entries = Object.entries(parsed as Record<string, unknown>)
        metadataText = entries
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(' · ')
      } else {
        metadataText = String(parsed)
      }
    } catch {
      metadataText = action.metadata
    }
  }

  return (
    <div className="bg-card flex items-start gap-2.5 rounded-xl border p-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: action.actor.avatarColor }}
          >
            {profileInitial(action.actor.name)}
          </div>
          <span className="truncate text-sm font-medium leading-tight">{meta.label}</span>
        </div>
        <div className="text-muted-foreground text-xs leading-tight">
          توسط <span className="text-foreground/80 font-medium">{action.actor.name}</span>
        </div>
        {action.reason && (
          <p className="bg-muted/60 rounded-md px-2 py-1 text-xs leading-snug">
            {action.reason}
          </p>
        )}
        {metadataText && (
          <p className="text-muted-foreground/80 truncate text-[11px] tabular-nums" dir="ltr">
            {metadataText}
          </p>
        )}
        <div className="text-muted-foreground/80 mt-0.5 text-[11px] tabular-nums">
          {formatJalaliDateTime(action.createdAt)} · {formatRelativeFa(action.createdAt)}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Audit tab -------------------------------- */

function AuditTab() {
  const [filter, setFilter] = useState<string>('all')
  const auditQuery = useModerationAudit(filter === 'all' ? undefined : filter)
  const actions = (auditQuery.data ?? []) as AuditAction[]

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: actions.length }
    for (const a of actions) map[a.actionType] = (map[a.actionType] ?? 0) + 1
    return map
  }, [actions])

  if (auditQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl"
          >
            <ClipboardList className="size-7" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">گزارش ممیزی خالی است</h3>
            <p className="text-muted-foreground text-sm">
              هیچ اقدام مدیریتی در این خانه ثبت نشده است.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <AuditFilters active={filter} onChange={setFilter} counts={counts} />
      <div className="space-y-2">
        {actions.map((a) => (
          <AuditRow key={a.id} action={a} />
        ))}
      </div>
    </div>
  )
}

/* --------------------------- Moderation view ------------------------------ */

/**
 * Role-gated moderation view (MODERATOR + OWNER). Members see an
 * access-denied card. Otherwise the view renders an amber header card with
 * the user's role label, then a two-tab layout: "صف بررسی" listing flagged
 * purchases (QueueCard with buyer avatar, item, points, amber reason box and
 * three action buttons — تأیید / رد / حل‌وفصل) and "گزارش ممیزی" listing past
 * moderation actions with color-coded icons, filter chips, actor name,
 * optional reason/metadata and a Jalali timestamp.
 */
export function ModerationView() {
  const role = useUserStore((s) => s.role)
  const isStaff = role === 'OWNER' || role === 'MODERATOR'
  const isOwner = role === 'OWNER'
  const roleLabel = role === 'OWNER' ? 'مدیر اصلی' : role === 'MODERATOR' ? 'ناظر' : 'عضو'

  if (!isStaff) return <AccessDenied />

  return (
    <div className="space-y-3">
      <HeaderCard roleLabel={roleLabel} />

      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queue">صف بررسی</TabsTrigger>
          <TabsTrigger value="audit">گزارش ممیزی</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="pt-3">
          <QueueTab isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="audit" className="pt-3">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
