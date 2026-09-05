import { withRetry } from '@/lib/retry'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { serializeLog } from '@/lib/api-serializers'
import type { PointTier } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_TIERS: PointTier[] = [1, 3, 5]
const TIER_POINTS: Record<number, number> = { 1: 1, 3: 3, 5: 5 }
const MAX_LIMIT = 500

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  const url = new URL(req.url)
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true'

  // FIX: Only allow owners and moderators to see deleted logs
  if (includeDeleted && ctx?.role !== 'OWNER' && ctx?.role !== 'MODERATOR') {
    return NextResponse.json({ error: 'شما اجازه مشاهده سطل زباله را ندارید' }, { status: 403 })
  }

  const limitParam = Number(url.searchParams.get('limit') ?? '200')

  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitParam) ? limitParam : 200))

  const householdId = ctx?.household?.id ?? null

  const where: { householdId: string | null; deletedAt?: Date | null } = { householdId }
  if (!includeDeleted) where.deletedAt = null

  const logs = await db.purchaseLog.findMany({
    where,
    orderBy: { purchasedAt: 'desc' },
    take: limit,
    include: { buyer: { select: { name: true, avatarColor: true } } },
  })

  return NextResponse.json({
    logs: logs.map((l) => serializeLog({
      id: l.id, itemId: l.itemId, itemTitle: l.itemTitle, buyerId: l.buyerId,
      buyer: l.buyer, pointTier: l.pointTier, pointsAwarded: l.pointsAwarded,
      purchasedAt: l.purchasedAt, status: l.status, deletedAt: l.deletedAt,
    }))
  })
}

interface CheckoutBody {
  itemId?: string
  buyerId?: string
  pointTier?: PointTier
  itemTitle?: string
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'برای ثبت خرید باید وارد شوید' }, { status: 401 })

  let body: CheckoutBody
  try {
    body = (await req.json()) as CheckoutBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const buyerId = (body.buyerId ?? '').trim()
  if (!buyerId) return NextResponse.json({ error: 'خریدار الزامی است' }, { status: 400 })

  // Verify buyer is a member of the active household.
  const buyer = await db.profile.findUnique({ where: { id: buyerId } })
  if (!buyer) return NextResponse.json({ error: 'خریدار یافت نشد' }, { status: 404 })
  if (ctx.household && buyer.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'خریدار عضو این خانه نیست' }, { status: 403 })
  if (!ctx.household && buyer.householdId !== null)
    return NextResponse.json({ error: 'خریدار عضو این محیط نیست' }, { status: 403 })

  const householdId = ctx.household?.id ?? null

  // Resolve item + tier + title + points.
  let itemId: string | null = null
  let itemTitle = (body.itemTitle ?? '').trim()
  let pointTier: PointTier = 1
  let pointsAwarded = 1

  if (body.itemId) {
    const item = await db.item.findUnique({ where: { id: body.itemId } })
    if (!item) return NextResponse.json({ error: 'کالا یافت نشد' }, { status: 404 })

    if (item.householdId !== null) {
      // Normal item: Verify it belongs to this household
      if (!ctx.household || item.householdId !== ctx.household.id)
        return NextResponse.json({ error: 'این کالا متعلق به خانه شما نیست' }, { status: 403 })

      itemId = item.id
      if (!itemTitle) itemTitle = item.title
    }
    else if (ctx.household) {
      // FIX: Demo item detected! We must CLONE it instead of mutating the global template.

      // 1. Check if we need to clone the category too
      const category = await db.category.findUnique({ where: { id: item.categoryId } })
      let clonedCategoryId = item.categoryId

      if (category && category.householdId === null) {
        // See if this household already has a clone of this category
        const existingCat = await db.category.findFirst({
          where: { householdId: ctx.household.id, title: category.title, icon: category.icon },
          select: { id: true },
        })
        if (existingCat) {
          clonedCategoryId = existingCat.id
        } else {
          // Create a new category clone for this household
          const newCat = await db.category.create({
            data: { householdId: ctx.household.id, title: category.title, icon: category.icon, sortOrder: category.sortOrder },
          })
          clonedCategoryId = newCat.id
        }
      }

      // 2. Create a new item clone for this household
      const clonedItem = await db.item.create({
        data: {
          householdId: ctx.household.id,
          categoryId: clonedCategoryId,
          title: item.title,
          pointTier: item.pointTier,
          status: 'in_stock',
        }
      })

      // 3. Use the NEW cloned item's ID for the purchase log
      itemId = clonedItem.id
      if (!itemTitle) itemTitle = clonedItem.title
    }

    pointTier = (VALID_TIERS.includes(item.pointTier as PointTier) ? item.pointTier : 1) as PointTier
    pointsAwarded = TIER_POINTS[pointTier] ?? pointTier
  } else {
    if (!itemTitle) return NextResponse.json({ error: 'نام کالا الزامی است' }, { status: 400 })
    if (body.pointTier && VALID_TIERS.includes(body.pointTier)) {
      pointTier = body.pointTier
      pointsAwarded = TIER_POINTS[pointTier] ?? pointTier
    }
  }

  const purchasedAt = new Date()

  // ✅ Wrap the database writes in our retry tool
  const log = await withRetry(async () => {
    return await db.purchaseLog.create({
      data: {
        householdId,
        itemId,
        itemTitle,
        buyerId,
        pointTier,
        pointsAwarded,
        purchasedAt,
        status: 'approved',
      },
      include: { buyer: { select: { name: true, avatarColor: true } } },
    })
  })

  // Restock the item (mark as in_stock + stamp last-bought-by) when an
  // itemId was provided.
  if (itemId) {
    await withRetry(async () => {
      await db.item.update({
        where: { id: itemId },
        data: { status: 'in_stock', lastBoughtAt: purchasedAt, lastBoughtById: buyerId },
      })
    })
  }

  return NextResponse.json(
    {
      log: serializeLog({
        id: log.id, itemId: log.itemId, itemTitle: log.itemTitle, buyerId: log.buyerId,
        buyer: log.buyer, pointTier: log.pointTier, pointsAwarded: log.pointsAwarded,
        purchasedAt: log.purchasedAt, status: log.status, deletedAt: log.deletedAt,
      })
    },
    { status: 201 },
  )
}
