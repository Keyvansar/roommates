import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { serializeItem } from '@/lib/api-serializers'
import type { ItemStatus, PointTier } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: ItemStatus[] = ['in_stock', 'depleted', 'in_cart']
const VALID_TIERS: PointTier[] = [1, 3, 5]

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status') as ItemStatus | null
  const categoryFilter = url.searchParams.get('categoryId')

  // Anonymous / demo mode: return the global demo items (householdId null).
  const householdId = ctx?.household?.id ?? null

  const where: { householdId: string | null; status?: ItemStatus; categoryId?: string } = { householdId }
  if (statusFilter && VALID_STATUSES.includes(statusFilter)) where.status = statusFilter
  if (categoryFilter) where.categoryId = categoryFilter

  const items = await db.item.findMany({
    where,
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
    include: {
      category: { select: { title: true, icon: true } },
      lastBoughtBy: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json({
    items: await Promise.all(items.map((it) => serializeItem({
      id: it.id,
      title: it.title,
      pointTier: it.pointTier,
      status: it.status,
      categoryId: it.categoryId,
      category: it.category,
      lastBoughtAt: it.lastBoughtAt,
      lastBoughtById: it.lastBoughtById,
      lastBoughtBy: it.lastBoughtBy,
    }))),
  })
}

interface CreateBody {
  title?: string
  categoryId?: string
  pointTier?: PointTier
  status?: ItemStatus
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'برای ساخت آیتم باید وارد شوید' }, { status: 401 })

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'نام کالا را وارد کنید' }, { status: 400 })

  const pointTier: PointTier = body.pointTier && VALID_TIERS.includes(body.pointTier) ? body.pointTier : 1
  const status: ItemStatus = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'in_stock'

  if (!body.categoryId) return NextResponse.json({ error: 'دسته کالا الزامی است' }, { status: 400 })

  // Auto-attach demo categories (householdId null) to the active household
  // when an authed user creates an item referencing them — same pattern as
  // the categories PATCH route. This keeps the shared catalog from leaking
  // edits across households.
  const category = await db.category.findUnique({ where: { id: body.categoryId } })
  if (!category) return NextResponse.json({ error: 'دسته یافت نشد' }, { status: 404 })

  let categoryId = category.id
  const householdId = ctx.household?.id ?? null

  if (category.householdId === null && ctx.household) {
    // Clone this demo category into the active household (if not already
    // cloned — we match by title + sortOrder) and use the cloned id.
    const existing = await db.category.findFirst({
      where: { householdId: ctx.household.id, title: category.title, icon: category.icon },
      select: { id: true },
    })
    if (existing) {
      categoryId = existing.id
    } else {
      const cloned = await db.category.create({
        data: {
          householdId: ctx.household.id,
          title: category.title,
          icon: category.icon,
          sortOrder: category.sortOrder,
        },
      })
      categoryId = cloned.id
    }
  } else if (category.householdId !== null) {
    if (!ctx.household || category.householdId !== ctx.household.id)
      return NextResponse.json({ error: 'این دسته متعلق به خانه شما نیست' }, { status: 403 })
  }

  const item = await db.item.create({
    data: { householdId, categoryId, title, pointTier, status },
    include: {
      category: { select: { title: true, icon: true } },
      lastBoughtBy: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json(
    { item: await serializeItem({
      id: item.id,
      title: item.title,
      pointTier: item.pointTier,
      status: item.status,
      categoryId: item.categoryId,
      category: item.category,
      lastBoughtAt: item.lastBoughtAt,
      lastBoughtById: item.lastBoughtById,
      lastBoughtBy: item.lastBoughtBy,
    }) },
    { status: 201 },
  )
}
