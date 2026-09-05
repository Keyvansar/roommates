import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { serializeItem } from '@/lib/api-serializers'
import type { ItemStatus, PointTier } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: ItemStatus[] = ['in_stock', 'depleted', 'in_cart']
const VALID_TIERS: PointTier[] = [1, 3, 5]

interface PatchBody {
  status?: ItemStatus
  pointTier?: PointTier
  title?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const item = await db.item.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'کالا یافت نشد' }, { status: 404 })

  // Verify household ownership. Demo items (householdId null) are
  // editable by any authed user (they'll be auto-attached on edit), but
  // household-bound items must belong to the caller's active household.
  if (item.householdId !== null) {
    if (!ctx.household || item.householdId !== ctx.household.id)
      return NextResponse.json({ error: 'این کالا متعلق به خانه شما نیست' }, { status: 403 })
  }

    // SECURITY FIX: Never modify global demo items in-place. Instead, clone the
    // item (and its category if also demo) into the user's household scope, then
    // apply the update to the clone. This prevents the first editor from "stealing"
    // a shared template from all other demo users.
    if (item.householdId === null && ctx.household) {
      // Clone the demo item into the household
      const category = await db.category.findUnique({ where: { id: item.categoryId } })
      let clonedCategoryId = item.categoryId
      if (category && category.householdId === null) {
        // Clone the category too if it's still a demo category
        const existing = await db.category.findFirst({
          where: { householdId: ctx.household.id, title: category.title, icon: category.icon },
          select: { id: true },
        })
        if (existing) {
          clonedCategoryId = existing.id
        } else {
          const clonedCat = await db.category.create({
            data: { householdId: ctx.household.id, title: category.title, icon: category.icon, sortOrder: category.sortOrder },
          })
          clonedCategoryId = clonedCat.id
        }
      }
      // Create a clone of the item with the update applied
      const cloned = await db.item.create({
        data: {
          householdId: ctx.household.id,
          categoryId: clonedCategoryId,
          title: body.title?.trim() || item.title,
          pointTier: body.pointTier !== undefined ? body.pointTier : item.pointTier,
          status: body.status !== undefined ? body.status : item.status,
        },
        include: { category: { select: { title: true, icon: true } }, lastBoughtBy: { select: { name: true, avatarColor: true } } },
      })
      return NextResponse.json({ item: await serializeItem({
        id: cloned.id, title: cloned.title, pointTier: cloned.pointTier, status: cloned.status,
        categoryId: cloned.categoryId, category: cloned.category,
        lastBoughtAt: cloned.lastBoughtAt, lastBoughtById: cloned.lastBoughtById,
        lastBoughtBy: cloned.lastBoughtBy,
      }) })
    }

  // Normal update for items already owned by the household
  const updates: { status?: ItemStatus; pointTier?: PointTier; title?: string } = {}
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status))
      return NextResponse.json({ error: 'وضعیت نامعتبر است' }, { status: 400 })
    updates.status = body.status
  }
  if (body.pointTier !== undefined) {
    if (!VALID_TIERS.includes(body.pointTier))
      return NextResponse.json({ error: 'تیر امتیاز نامعتبر است' }, { status: 400 })
    updates.pointTier = body.pointTier
  }
  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'نام کالا نمی‌تواند خالی باشد' }, { status: 400 })
    updates.title = t
  }

  const updated = await db.item.update({
    where: { id },
    data: updates,
    include: {
      category: { select: { title: true, icon: true } },
      lastBoughtBy: { select: { name: true, avatarColor: true } },
    },
  })

  return NextResponse.json({
    item: await serializeItem({
      id: updated.id,
      title: updated.title,
      pointTier: updated.pointTier,
      status: updated.status,
      categoryId: updated.categoryId,
      category: updated.category,
      lastBoughtAt: updated.lastBoughtAt,
      lastBoughtById: updated.lastBoughtById,
      lastBoughtBy: updated.lastBoughtBy,
    }),
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  const item = await db.item.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'کالا یافت نشد' }, { status: 404 })

  // SECURITY FIX: Never delete global demo items — they're shared templates.
  // Only allow deleting items owned by the user's household.
  if (item.householdId === null) {
    return NextResponse.json({ error: 'کالاهای نمونه قابل حذف نیستند' }, { status: 403 })
  }

  if (!ctx.household || item.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این کالا متعلق به خانه شما نیست' }, { status: 403 })

  await db.item.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
