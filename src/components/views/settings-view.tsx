'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Bell,
  Check,
  ChevronDown,
  Copy,
  Info,
  KeyRound,
  LogOut,
  Moon,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
  TriangleAlert,
  UserCog,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CategoryIcon, CATEGORY_ICON_LIST } from '@/components/category-icon'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReseed,
  useUpdateCategory,
} from '@/hooks/use-data'
import {
  useChangeMemberRole,
  useRemoveMember,
} from '@/hooks/use-moderation'
import {
  useChangePassword,
  useCreateHousehold,
  useDeleteAccount,
  useDeleteHousehold,
  useHouseholdSettings,
  useLeaveHousehold,
  useLogout,
  useMe,
  useRegenerateInvite,
  useUpdateHouseholdSettings,
  useUpdateProfile,
} from '@/hooks/use-auth'
import { useAppearance } from '@/components/appearance-provider'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useUserStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/* ------------------------------- Constants -------------------------------- */

const APP_VERSION = '۱.۰.۰'

/** Avatar color palette — kept in sync with the backend AVATAR_COLORS list. */
const AVATAR_COLOR_PALETTE = [
  '#0d9488', '#d97706', '#dc2626', '#7c3aed',
  '#2563eb', '#059669', '#db2777', '#65a30d',
  '#0891b2', '#ea580c', '#9333ea', '#ca8a04',
]

const AVATAR_EMOJIS = ['🛒', '🥑', '🍎', '🥕', '🥛', '🍞', '☕', '🧼', '🪥', '🧻', '🍕', '🍪']

const TIERS = [
  { key: '1', label: 'سبک', points: 1, color: '#10b981' },
  { key: '3', label: 'متوسط', points: 3, color: '#f59e0b' },
  { key: '5', label: 'سنگین', points: 5, color: '#ef4444' },
] as const

const NOTIF_KEYS = ['depleted', 'turn', 'edit'] as const
type NotifKey = (typeof NOTIF_KEYS)[number]
const NOTIF_LABELS: Record<NotifKey, string> = {
  depleted: 'هشدار اتمام کالا',
  turn: 'یادآوری نوبت خرید',
  edit: 'هشدار ویرایش/حذف',
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'مالک',
  MODERATOR: 'ناظر',
  MEMBER: 'عضو',
}

/* ------------------------------- Helpers ---------------------------------- */

function profileInitial(name: string): string {
  return name?.trim()?.[0] ?? '؟'
}

function useNotifFlags() {
  const [flags, setFlags] = useState<Record<NotifKey, boolean>>(() => {
    if (typeof window === 'undefined') return { depleted: true, turn: true, edit: true }
    try {
      const raw = window.localStorage.getItem('hamkhaneh-notif')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<NotifKey, boolean>>
        return { depleted: true, turn: true, edit: true, ...parsed }
      }
    } catch { /* ignore */ }
    return { depleted: true, turn: true, edit: true }
  })

  useEffect(() => {
    try { window.localStorage.setItem('hamkhaneh-notif', JSON.stringify(flags)) } catch { /* ignore */ }
  }, [flags])

  return [flags, (k: NotifKey, v: boolean) => setFlags((s) => ({ ...s, [k]: v }))] as const
}

/* --------------------------- Section: Profile ----------------------------- */

function ProfileSection() {
  const meQuery = useMe()
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const logout = useLogout()
  const fa = useFaDigits()

  const meUser = meQuery.data?.user
  const [name, setName] = useState('')
  const [color, setColor] = useState('#0d9488')
  const [emoji, setEmoji] = useState<string>('🛒')
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  // Sync local form with server data once it arrives.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!meUser || hydrated) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(meUser.name)
    setColor(meUser.avatarColor)
    setEmoji(meUser.avatarEmoji ?? '🛒')
    setHydrated(true)
  }, [meUser, hydrated])

  // Also re-sync when the underlying user changes (e.g. after switching household).
  useEffect(() => {
    if (!meUser) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(meUser.name)
    setColor(meUser.avatarColor)
    setEmoji(meUser.avatarEmoji ?? '🛒')
  }, [meUser?.id, meUser?.name, meUser?.avatarColor, meUser?.avatarEmoji])

  const dirty = name !== (meUser?.name ?? '') ||
    color !== (meUser?.avatarColor ?? '#0d9488') ||
    emoji !== (meUser?.avatarEmoji ?? '🛒')

  const handleSave = () => {
    updateProfile.mutate({
      name: name.trim() || undefined,
      avatarColor: color,
      avatarEmoji: emoji,
    })
  }

  const handleChangePassword = () => {
    if (!currentPwd || !newPwd) return
    changePassword.mutate(
      { currentPassword: currentPwd, newPassword: newPwd },
      {
        onSuccess: () => {
          setCurrentPwd('')
          setNewPwd('')
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      {/* Avatar preview */}
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: color }}
        >
          <span className="text-white">{emoji}</span>
        </div>
        <div className="text-muted-foreground text-xs leading-tight">
          <p>نمونه‌ی نمایش پروفایل شما.</p>
          <p>رنگ و ایموجی هم در پروفایل خانه‌ی فعال به‌روز می‌شود.</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">نام نمایشی</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      {/* Color picker */}
      <div className="space-y-1.5">
        <Label>رنگ آواتار</Label>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {AVATAR_COLOR_PALETTE.map((c) => {
            const isActive = color === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`رنگ ${c}`}
                aria-pressed={isActive}
                className={cn(
                  'tap-size flex aspect-square items-center justify-center rounded-full text-white transition-transform hover:scale-110',
                  isActive && 'ring-2 ring-offset-2 ring-offset-background',
                )}
                style={{ backgroundColor: c, ...(isActive ? { boxShadow: `0 0 0 2px ${c}` } : undefined) }}
              >
                {isActive && <Check className="size-3.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Emoji picker */}
      <div className="space-y-1.5">
        <Label>ایموجی</Label>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {AVATAR_EMOJIS.map((e) => {
            const isActive = emoji === e
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={`ایموجی ${e}`}
                aria-pressed={isActive}
                className={cn(
                  'tap-scale flex aspect-square items-center justify-center rounded-lg border text-lg transition-colors',
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-accent/40',
                )}
              >
                {e}
              </button>
            )
          })}
        </div>
      </div>

      <Button onClick={handleSave} disabled={!dirty || updateProfile.isPending} className="w-full gap-1.5">
        <Check className="size-4" />
        {updateProfile.isPending ? 'در حال ذخیره…' : 'ذخیره پروفایل'}
      </Button>

      {/* Change password */}
      <div className="border-t pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4" />
          تغییر رمز عبور
        </div>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="رمز فعلی"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            dir="ltr"
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="رمز جدید (حداقل ۶ کاراکتر)"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            dir="ltr"
            autoComplete="new-password"
          />
          <Button
            variant="outline"
            onClick={handleChangePassword}
            disabled={!currentPwd || !newPwd || changePassword.isPending || newPwd.length < 6}
            className="w-full gap-1.5"
          >
            <KeyRound className="size-4" />
            {changePassword.isPending ? 'در حال تغییر…' : 'تغییر رمز'}
          </Button>
        </div>
      </div>

      <div className="border-t pt-3">
        <Button
          variant="outline"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="w-full gap-1.5"
        >
          <LogOut className="size-4" />
          {logout.isPending ? 'در حال خروج…' : 'خروج از حساب'}
        </Button>
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          نسخه‌ی هم‌خانه‌یاب: <span className="font-medium">{fa(APP_VERSION)}</span>
        </p>
      </div>
    </div>
  )
}

/* --------------------------- Section: Household ---------------------------- */

function HouseholdSection() {
  const meQuery = useMe()
  const regenerate = useRegenerateInvite()
  const changeRole = useChangeMemberRole()
  const removeMember = useRemoveMember()
  const createHousehold = useCreateHousehold()
  const [copied, setCopied] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')

  const me = meQuery.data
  const household = me?.household ?? null
  const role = me?.role ?? null
  const canManageInvite = role === 'OWNER' || role === 'MODERATOR'
  const isOwner = role === 'OWNER'

  const handleCopy = async () => {
    if (!household) return
    try {
      await navigator.clipboard.writeText(household.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  if (!household) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          هنوز در خانه‌ای عضو نشده‌اید. یک خانه‌ی جدید بسازید یا با کد دعوت به خانه‌ی دیگر بپیوندید.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="new-house-name">نام خانه‌ی جدید</Label>
          <Input
            id="new-house-name"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
            placeholder="مثلاً خانه دوستی"
          />
        </div>
        <Button
          onClick={() => createHousehold.mutate({ name: newHouseholdName.trim() })}
          disabled={!newHouseholdName.trim() || createHousehold.isPending}
          className="w-full gap-1.5"
        >
          <Plus className="size-4" />
          {createHousehold.isPending ? 'در حال ساخت…' : 'ساخت خانه‌ی جدید'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="house-name">نام خانه</Label>
        <Input id="house-name" value={household.name} disabled />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-code">کد دعوت</Label>
        <div className="flex gap-2">
          <Input
            id="invite-code"
            value={household.inviteCode}
            readOnly
            dir="ltr"
            className="flex-1 tracking-widest"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label="کپی کد دعوت"
            title="کپی کد"
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </Button>
          {canManageInvite && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => regenerate.mutate(household.id)}
              disabled={regenerate.isPending}
              aria-label="ساخت کد دعوت جدید"
              title="ساخت کد دعوت جدید"
            >
              <RefreshCw className={cn('size-4', regenerate.isPending && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="space-y-2">
        <Label>اعضا</Label>
        <ul className="space-y-2">
          {me?.profiles.map((p) => {
            const isSelf = p.isMe
            const canManage = isOwner && !isSelf && p.role !== 'OWNER'
            return (
              <li
                key={p.id}
                className="bg-card flex items-center gap-2 rounded-xl border p-2"
              >
                <div
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: p.avatarColor }}
                >
                  {profileInitial(p.name)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium leading-tight">
                    {p.name} {isSelf && <span className="text-muted-foreground text-xs">(شما)</span>}
                  </span>
                  <RoleBadge role={p.role} />
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="مدیریت عضو">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuLabel>مدیریت نقش</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={p.role === 'MODERATOR'}
                        onClick={() => changeRole.mutate({ householdId: household.id, userId: p.userId ?? '', role: 'MODERATOR' })}
                      >
                        <UserCog className="size-4" />
                        ارتقا به ناظر
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={p.role === 'MEMBER'}
                        onClick={() => changeRole.mutate({ householdId: household.id, userId: p.userId ?? '', role: 'MEMBER' })}
                      >
                        <ChevronDown className="size-4" />
                        تنزل به عضو
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => changeRole.mutate({ householdId: household.id, userId: p.userId ?? '', transferOwnership: true })}
                      >
                        <ShieldCheck className="size-4" />
                        انتقال مالکیت
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => removeMember.mutate({ householdId: household.id, userId: p.userId ?? '' })}
                      >
                        <UserMinus className="size-4" />
                        حذف از خانه
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABELS[role] ?? role
  if (role === 'OWNER') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        <ShieldCheck className="size-2.5" />
        {label}
      </span>
    )
  }
  if (role === 'MODERATOR') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <Shield className="size-2.5" />
        {label}
      </span>
    )
  }
  return (
    <span className="text-muted-foreground text-[10px]">{label}</span>
  )
}

/* --------------------------- Section: Categories --------------------------- */

function CategoriesSection() {
  const categoriesQuery = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const del = useDeleteCategory()

  const [newTitle, setNewTitle] = useState('')
  const [newIcon, setNewIcon] = useState('ShoppingBasket')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editIcon, setEditIcon] = useState('ShoppingBasket')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const categories = categoriesQuery.data ?? []
  const canDelete = categories.length > 1

  const handleCreate = () => {
    if (!newTitle.trim()) return
    create.mutate(
      { title: newTitle.trim(), icon: newIcon },
      { onSuccess: () => setNewTitle('') },
    )
  }

  const startEdit = (id: string, title: string, icon: string) => {
    setEditingId(id)
    setEditTitle(title)
    setEditIcon(icon)
  }

  const saveEdit = () => {
    if (!editingId) return
    update.mutate(
      { id: editingId, title: editTitle.trim(), icon: editIcon },
      { onSuccess: () => setEditingId(null) },
    )
  }

  return (
    <div className="space-y-3">
      {/* Add new category */}
      <div className="bg-card space-y-2 rounded-xl border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-cat-title">دسته‌ی جدید</Label>
          <Input
            id="new-cat-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="نام دسته"
          />
        </div>
        <IconPicker value={newIcon} onChange={setNewIcon} />
        <Button
          onClick={handleCreate}
          disabled={!newTitle.trim() || create.isPending}
          className="w-full gap-1.5"
        >
          <Plus className="size-4" />
          {create.isPending ? 'در حال افزودن…' : 'افزودن دسته'}
        </Button>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {categories.map((c) => {
          const isEditing = editingId === c.id
          return (
            <li key={c.id} className="bg-card rounded-xl border p-3">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="نام دسته"
                  />
                  <IconPicker value={editIcon} onChange={setEditIcon} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={update.isPending} className="flex-1 gap-1.5">
                      <Check className="size-4" />
                      ذخیره
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="flex-1">
                      انصراف
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span aria-hidden className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <CategoryIcon name={c.icon} size={18} />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{c.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    aria-label={`ویرایش ${c.title}`}
                    onClick={() => startEdit(c.id, c.title, c.icon)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive size-8 shrink-0"
                    aria-label={`حذف ${c.title}`}
                    disabled={!canDelete}
                    onClick={() => setDeleteId(c.id)}
                    title={canDelete ? `حذف ${c.title}` : 'حداقل باید یک دسته باقی بماند'}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دسته؟</AlertDialogTitle>
            <AlertDialogDescription>
              اقلام این دسته به اولین دسته‌ی باقی‌مانده منتقل می‌شوند. این عمل برگشت‌ناپذیر است.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) del.mutate({ id: deleteId })
                setDeleteId(null)
              }}
            >
              بله، حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
      {CATEGORY_ICON_LIST.map((name) => {
        const isActive = value === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            aria-label={name}
            aria-pressed={isActive}
            className={cn(
              'tap-scale flex aspect-square items-center justify-center rounded-lg border transition-colors',
              isActive ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:bg-accent/40',
            )}
          >
            <CategoryIcon name={name} size={18} />
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------- Section: Point Tiers ------------------------ */

function TiersSection() {
  const household = useUserStore((s) => s.household)
  const settings = useHouseholdSettings(household?.id)
  const update = useUpdateHouseholdSettings()

  const [labels, setLabels] = useState<Record<string, string>>({ '1': 'سبک', '3': 'متوسط', '5': 'سنگین' })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!settings.data || hydrated) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabels({
      '1': settings.data.tierLabels?.['1'] ?? 'سبک',
      '3': settings.data.tierLabels?.['3'] ?? 'متوسط',
      '5': settings.data.tierLabels?.['5'] ?? 'سنگین',
    })
    setHydrated(true)
  }, [settings.data, hydrated])

  const dirty = useMemo(() => {
    if (!settings.data) return false
    const cur = settings.data.tierLabels
    return TIERS.some((t) => (labels[t.key] ?? '') !== (cur?.[t.key] ?? t.label))
  }, [labels, settings.data])

  const handleSave = () => {
    if (!household) return
    update.mutate({ id: household.id, tierLabels: labels })
  }

  const handleReset = () => {
    setLabels({ '1': 'سبک', '3': 'متوسط', '5': 'سنگین' })
    if (household) update.mutate({ id: household.id, tierLabels: null })
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-tight">
        برچسب سه تیر امتیاز را می‌توانید به دلخواه بازنامی کنید. مقدار امتیاز هر تیر ثابت است (۱، ۳ و ۵).
      </p>
      {TIERS.map((t) => (
        <div key={t.key} className="space-y-1.5">
          <Label htmlFor={`tier-${t.key}`} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            تیر {t.key} · <span className="text-muted-foreground text-[11px]">{t.points} امتیاز</span>
          </Label>
          <Input
            id={`tier-${t.key}`}
            value={labels[t.key] ?? ''}
            onChange={(e) => setLabels((s) => ({ ...s, [t.key]: e.target.value }))}
            style={{ borderColor: dirty && labels[t.key] !== (settings.data?.tierLabels?.[t.key] ?? t.label) ? t.color : undefined }}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!household || !dirty || update.isPending} className="flex-1 gap-1.5">
          <Check className="size-4" />
          {update.isPending ? 'در حال ذخیره…' : 'ذخیره برچسب‌ها'}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={!household || update.isPending} className="flex-1 gap-1.5">
          <RotateCcw className="size-4" />
          بازنشانی
        </Button>
      </div>
    </div>
  )
}

/* --------------------------- Section: Appearance -------------------------- */

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const { faDigits, setFaDigits, compact, setCompact } = useAppearance()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const themes: { key: string; label: string; icon: typeof Sun }[] = [
    { key: 'light', label: 'روشن', icon: Sun },
    { key: 'dark', label: 'تیره', icon: Moon },
    { key: 'system', label: 'سیستم', icon: SettingsIcon },
  ]

  return (
    <div className="space-y-4">
      {/* Theme */}
      <div className="space-y-2">
        <Label>پوسته</Label>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => {
            const Icon = t.icon
            const isActive = (mounted ? theme : 'system') === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTheme(t.key)}
                aria-pressed={isActive}
                className={cn(
                  'tap-scale flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm transition-colors',
                  isActive ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card hover:bg-accent/40',
                )}
              >
                <Icon className="size-5" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Persian digits */}
      <div className="flex items-center justify-between gap-2 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">ارقام فارسی</p>
          <p className="text-muted-foreground text-xs">نمایش اعداد با ۰۱۲۳۴۵۶۷۸۹</p>
        </div>
        <Switch checked={faDigits} onCheckedChange={setFaDigits} aria-label="ارقام فارسی" />
      </div>

      {/* Compact mode */}
      <div className="flex items-center justify-between gap-2 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">حالت فشرده</p>
          <p className="text-muted-foreground text-xs">فاصله‌ی کمتر بین عناصر صفحه</p>
        </div>
        <Switch checked={compact} onCheckedChange={setCompact} aria-label="حالت فشرده" />
      </div>
    </div>
  )
}

/* --------------------------- Section: Notifications ------------------------ */

function NotificationsSection() {
  const [flags, setFlag] = useNotifFlags()
  return (
    <div className="space-y-2">
      {NOTIF_KEYS.map((k) => (
        <div key={k} className="flex items-center justify-between gap-2 rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">{NOTIF_LABELS[k]}</p>
          </div>
          <Switch
            checked={flags[k]}
            onCheckedChange={(v) => setFlag(k, v)}
            aria-label={NOTIF_LABELS[k]}
          />
        </div>
      ))}
      <p className="text-muted-foreground text-[11px] leading-tight">
        تنظیمات اعلان‌ها روی همین مرورگر ذخیره می‌شود.
      </p>
    </div>
  )
}

/* ------------------------------- Section: About ---------------------------- */

function AboutSection() {
  const meQuery = useMe()
  const reseed = useReseed()
  const leave = useLeaveHousehold()
  const deleteHousehold = useDeleteHousehold()
  const deleteAccount = useDeleteAccount()

  const me = meQuery.data
  const household = me?.household ?? null
  const role = me?.role ?? null
  const isOwner = role === 'OWNER'

  const [resetOpen, setResetOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [delHouseOpen, setDelHouseOpen] = useState(false)
  const [delAccOpen, setDelAccOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-xs leading-tight">
        <p>هم‌خانه‌یاب — مدیریت خریدهای مصرفی خانه با تراز امتیاز.</p>
        <p className="mt-1">نسخه: ۱.۰.۰ · داده‌ها به‌صورت محلی ذخیره می‌شود.</p>
      </div>

      {/* Reset catalog */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">بازنشانی کاتالوگ</p>
        <p className="text-muted-foreground text-xs leading-tight">
          کالاها، خریدها و امتیازها به حالت اولیه برمی‌گردند. این عمل برگشت‌ناپذیر است.
        </p>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full gap-1.5" disabled={reseed.isPending}>
              <RotateCcw className="size-4" />
              {reseed.isPending ? 'در حال بازنشانی…' : 'بازنشانی کاتالوگ'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>بازنشانی کاتالوگ؟</AlertDialogTitle>
              <AlertDialogDescription>
                همه کالاها، خریدها و امتیازها حذف و داده‌های اولیه بازنوشته می‌شود.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>انصراف</AlertDialogCancel>
              <AlertDialogAction onClick={() => reseed.mutate()}>بله، بازنشانی کن</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Danger zone */}
      <div className="border-t pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
          <TriangleAlert className="size-4" />
          منطقه‌ی خطر
        </div>

        <div className="space-y-2">
          {household && !isOwner && (
            <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-1.5 text-destructive hover:text-destructive" disabled={leave.isPending}>
                  <UserX className="size-4" />
                  {leave.isPending ? 'در حال خروج…' : 'ترک خانه'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ترک خانه؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    خریدها و نقش شما در این خانه حذف می‌شود. این عمل برگشت‌ناپذیر است.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => leave.mutate(household.id)}
                  >
                    بله، ترک کنم
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {household && isOwner && (
            <AlertDialog open={delHouseOpen} onOpenChange={(v) => { setDelHouseOpen(v); if (!v) setConfirmText('') }}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-1.5 text-destructive hover:text-destructive" disabled={deleteHousehold.isPending}>
                  <Trash2 className="size-4" />
                  {deleteHousehold.isPending ? 'در حال حذف…' : 'حذف خانه'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف خانه؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    همه‌ی کالاها، خریدها، اعضا و داده‌های این خانه برای همیشه حذف می‌شود. برای تأیید، نام «{household.name}» را وارد کنید.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={household.name}
                  autoFocus
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={confirmText !== household.name}
                    onClick={() => deleteHousehold.mutate(household.id)}
                  >
                    بله، حذف کامل
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <AlertDialog open={delAccOpen} onOpenChange={setDelAccOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-1.5 text-destructive hover:text-destructive" disabled={deleteAccount.isPending}>
                <UserMinus className="size-4" />
                {deleteAccount.isPending ? 'در حال حذف…' : 'حذف حساب کاربری'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف حساب کاربری؟</AlertDialogTitle>
                <AlertDialogDescription>
                  همه‌ی خانه‌ها، پروفایل‌ها و داده‌های شما حذف می‌شود. این عمل برگشت‌ناپذیر است.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>انصراف</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => deleteAccount.mutate()}
                >
                  بله، حذف کن
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Settings view ------------------------------ */

/**
 * Settings. Renders seven accordion sections: profile, household,
 * categories, point tiers, appearance, notifications and about. Each section
 * is self-contained and pulls its own data via the relevant hooks
 * (`useMe`, `useHouseholdSettings`, `useCategories`, …). The about section
 * also exposes a "reset catalog" button (AlertDialog) and the danger zone
 * (leave / delete household + delete account) — owner-only destructive
 * actions require a type-to-confirm guard.
 */
export function SettingsView() {
  return (
    <div className="space-y-3">
      <Card className="border-0 overflow-hidden py-0">
        <div className="bg-gradient-to-bl from-emerald-500/15 via-emerald-500/10 to-amber-500/15 p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="bg-emerald-500/20 text-emerald-700 flex size-11 shrink-0 items-center justify-center rounded-xl dark:text-emerald-300"
            >
              <SettingsIcon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="text-lg font-bold leading-tight">تنظیمات</h2>
              <p className="text-muted-foreground text-xs leading-tight">
                پروفایل، خانه، دسته‌ها و ظاهر برنامه را مدیریت کنید.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Accordion type="multiple" defaultValue={['profile']} className="w-full">
        <AccordionItem value="profile" className="bg-card rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <UserCog className="size-4" />
              پروفایل
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ProfileSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="household" className="bg-card mt-3 rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Users className="size-4" />
              خانه و اعضا
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <HouseholdSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="categories" className="bg-card mt-3 rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <SettingsIcon className="size-4" />
              دسته‌ها
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CategoriesSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tiers" className="bg-card mt-3 rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4" />
              تیرهای امتیاز
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <TiersSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="appearance" className="bg-card mt-3 rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sun className="size-4" />
              ظاهر
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <AppearanceSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notifications" className="bg-card mt-3 rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Bell className="size-4" />
              اعلان‌ها
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <NotificationsSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="about" className="bg-card mt-3 rounded-xl border px-3">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Info className="size-4" />
              درباره و خطر
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <AboutSection />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
