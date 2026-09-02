// Shared domain types for the Household Shopping PWA.

export type ItemStatus = 'in_stock' | 'depleted' | 'in_cart'
export type PointTier = 1 | 3 | 5

export interface ProfileDTO {
  id: string
  name: string
  avatarColor: string
  pin: string | null
}

export interface CategoryDTO {
  id: string
  title: string
  icon: string
  sortOrder: number
}

export interface ItemDTO {
  id: string
  title: string
  pointTier: PointTier
  status: ItemStatus
  categoryId: string
  categoryTitle: string
  categoryIcon: string
  lastBoughtAt: string | null
  lastBoughtById: string | null
  lastBoughtByName: string | null
  lastBoughtByColor: string | null
}

export interface PurchaseLogDTO {
  id: string
  itemId: string | null
  itemTitle: string
  buyerId: string
  buyerName: string
  buyerColor: string
  pointTier: PointTier
  pointsAwarded: number
  purchasedAt: string
  status?: string
  deletedAt?: string | null
}

export interface BalanceDTO {
  profiles: Array<{
    id: string
    name: string
    avatarColor: string
    totalPoints: number
  }>
  delta: number
  nextBuyerId: string | null
  nextBuyerName: string | null
  nextBuyerColor: string | null
  debtPoints: number
  leaderName: string | null
}

export const TIER_META: Record<PointTier, { label: string; points: number; color: string }> = {
  1: { label: 'سبک', points: 1, color: '#10b981' },
  3: { label: 'متوسط', points: 3, color: '#f59e0b' },
  5: { label: 'سنگین', points: 5, color: '#ef4444' },
}

export const STATUS_META: Record<ItemStatus, { label: string; color: string }> = {
  in_stock: { label: 'موجود', color: '#10b981' },
  depleted: { label: 'تمام‌شده', color: '#ef4444' },
  in_cart: { label: 'در سبد', color: '#f59e0b' },
}
