// Tab definitions for the bottom navigation of the هم‌خانه‌یاب PWA.
//
// `TabKey` enumerates the seven top-level views; `TabDef` carries the
// localized label, the lucide icon and an optional minimum role gate used
// by `BottomNav` to filter the visible tabs for the current user.

import {
  BarChart3,
  Boxes,
  History,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'

export type TabKey = 'inventory' | 'to-buy' | 'balance' | 'insights' | 'history' | 'moderation' | 'settings'

export interface TabDef {
  key: TabKey
  label: string
  icon: LucideIcon
  /** When set, the tab is only rendered for users with this role (or higher). */
  minRole?: 'MODERATOR' | 'OWNER'
}

export const TABS: TabDef[] = [
  { key: 'inventory', label: 'موجودی', icon: Boxes },
  { key: 'to-buy', label: 'خرید', icon: ShoppingCart },
  { key: 'balance', label: 'تراز', icon: Scale },
  { key: 'insights', label: 'تحلیل', icon: BarChart3 },
  { key: 'history', label: 'تاریخچه', icon: History },
  { key: 'moderation', label: 'مدیریت', icon: ShieldCheck, minRole: 'MODERATOR' },
  { key: 'settings', label: 'تنظیمات', icon: Settings },
]

/** Numeric rank used to compare roles. Higher = more privileged. */
export const ROLE_RANK: Record<'OWNER' | 'MODERATOR' | 'MEMBER', number> = {
  MEMBER: 0,
  MODERATOR: 1,
  OWNER: 2,
}

/** Returns true when `role` meets or exceeds the `minRole` gate. */
export function hasMinRole(
  role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null,
  minRole?: 'MODERATOR' | 'OWNER',
): boolean {
  if (!minRole) return true
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}
