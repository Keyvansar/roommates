import { db } from '@/lib/db'
import type {
  ProfileDTO, ItemDTO, PurchaseLogDTO, BalanceDTO, PointTier,
} from '@/lib/types'

export function serializeProfile(p: { id: string; name: string; avatarColor: string; pin: string | null }): ProfileDTO {
  return { id: p.id, name: p.name, avatarColor: p.avatarColor, pin: p.pin }
}

export async function serializeItem(it: {
  id: string; title: string; pointTier: number; status: string; categoryId: string
  category: { title: string; icon: string } | null
  lastBoughtAt: Date | null; lastBoughtById: string | null
  lastBoughtBy: { name: string; avatarColor: string } | null
}): Promise<ItemDTO> {
  return {
    id: it.id, title: it.title, pointTier: it.pointTier as PointTier, status: it.status as ItemDTO['status'],
    categoryId: it.categoryId, categoryTitle: it.category?.title ?? '', categoryIcon: it.category?.icon ?? 'Package',
    lastBoughtAt: it.lastBoughtAt ? it.lastBoughtAt.toISOString() : null,
    lastBoughtById: it.lastBoughtById,
    lastBoughtByName: it.lastBoughtBy?.name ?? null,
    lastBoughtByColor: it.lastBoughtBy?.avatarColor ?? null,
  }
}

export function serializeLog(l: {
  id: string; itemId: string | null; itemTitle: string; buyerId: string
  buyer: { name: string; avatarColor: string } | null
  pointTier: number; pointsAwarded: number; purchasedAt: Date; status?: string; deletedAt?: Date | null
}): PurchaseLogDTO {
  return {
    id: l.id, itemId: l.itemId, itemTitle: l.itemTitle, buyerId: l.buyerId,
    buyerName: l.buyer?.name ?? '—', buyerColor: l.buyer?.avatarColor ?? '#6b7280',
    pointTier: l.pointTier as PointTier, pointsAwarded: l.pointsAwarded,
    purchasedAt: l.purchasedAt.toISOString(), status: l.status, deletedAt: l.deletedAt ? l.deletedAt.toISOString() : null,
  }
}

export async function computeBalance(householdId?: string | null): Promise<BalanceDTO> {
  const profileWhere = householdId ? { householdId } : { householdId: null }
  const logWhere = householdId ? { householdId, deletedAt: null } : { householdId: null, deletedAt: null }

  const profiles = await db.profile.findMany({ where: profileWhere, orderBy: { createdAt: 'asc' } })

  if (profiles.length < 2) {
    return {
      profiles: profiles.map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor, totalPoints: 0 })),
      delta: 0, nextBuyerId: null, nextBuyerName: null, nextBuyerColor: null, debtPoints: 0, leaderName: null,
    }
  }

  const logs = await db.purchaseLog.findMany({ where: logWhere, select: { buyerId: true, pointsAwarded: true } })
  const totals = new Map<string, number>()
  for (const l of logs) totals.set(l.buyerId, (totals.get(l.buyerId) ?? 0) + l.pointsAwarded)

  const p0 = profiles[0], p1 = profiles[1]
  const score0 = totals.get(p0.id) ?? 0, score1 = totals.get(p1.id) ?? 0
  const delta = score0 - score1

  let nextBuyer: typeof p0 | null = null
  let debtPoints = 0
  let leaderName: string | null = null

  if (delta > 0) { nextBuyer = p1; debtPoints = delta; leaderName = p0.name }
  else if (delta < 0) { nextBuyer = p0; debtPoints = -delta; leaderName = p1.name }

  return {
    profiles: [
      { id: p0.id, name: p0.name, avatarColor: p0.avatarColor, totalPoints: score0 },
      { id: p1.id, name: p1.name, avatarColor: p1.avatarColor, totalPoints: score1 },
    ],
    delta, nextBuyerId: nextBuyer?.id ?? null, nextBuyerName: nextBuyer?.name ?? null,
    nextBuyerColor: nextBuyer?.avatarColor ?? null, debtPoints, leaderName,
  }
}
