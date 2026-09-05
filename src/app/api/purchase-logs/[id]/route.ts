import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { serializeLog } from '@/lib/api-serializers'
import type { PointTier } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_TIERS: PointTier[] = [1, 3, 5]
const TIER_POINTS: Record<number, number> = { 1: 1, 3: 3, 5: 5 }
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

interface PatchBody {
  buyerId?: string
  pointTier?: PointTier
  itemTitle?: string
  reason?: string
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

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })

  if (log.householdId !== null) {
    if (!ctx.household || log.householdId !== ctx.household.id)
      return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })
  }

  const householdId = ctx.household?.id ?? null

  // Permission: own log within 24h is free; otherwise MODERATOR+.
  const isOwnLog = ctx.profile?.id === log.buyerId
  const withinWindow = (Date.now() - log.purchasedAt.getTime()) <= EDIT_WINDOW_MS
  const isStaff = ctx.role === 'OWNER' || ctx.role === 'MODERATOR'

  if (!isStaff) {
    if (!isOwnLog)
      return NextResponse.json({ error: 'فقط خریدار یا مدیر می‌توانند رکورد را ویرایش کنند' }, { status: 403 })
    if (!withinWindow)
      return NextResponse.json({ error: 'ویرایش فقط تا ۲۴ ساعت پس از خرید مجاز است' }, { status: 403 })
  }

  const updates: { buyerId?: string; pointTier?: number; pointsAwarded?: number; itemTitle?: string } = {}

  if (body.buyerId !== undefined) {
    const buyer = await db.profile.findUnique({ where: { id: body.buyerId } })
    if (!buyer) return NextResponse.json({ error: 'خریدار یافت نشد' }, { status: 404 })
    if (ctx.household && buyer.householdId !== ctx.household.id)
      return NextResponse.json({ error: 'خریدار عضو این خانه نیست' }, { status: 400 })
    if (!ctx.household && buyer.householdId !== null)
      return NextResponse.json({ error: 'خریدار عضو این محیط نیست' }, { status: 400 })
    updates.buyerId = body.buyerId
  }

  if (body.pointTier !== undefined) {
    if (!VALID_TIERS.includes(body.pointTier))
      return NextResponse.json({ error: 'تیر امتیاز نامعتبر است' }, { status: 400 })
    updates.pointTier = body.pointTier
    updates.pointsAwarded = TIER_POINTS[body.pointTier] ?? body.pointTier
  }

  if (body.itemTitle !== undefined) {
    const t = body.itemTitle.trim()
    if (!t) return NextResponse.json({ error: 'نام کالا نمی‌تواند خالی باشد' }, { status: 400 })
    updates.itemTitle = t
  }

  const updated = await db.purchaseLog.update({
    where: { id },
    data: updates,
    include: { buyer: { select: { name: true, avatarColor: true } } },
  })

  // Audit log — only meaningful inside a household.
  if (householdId) {
    await db.moderationAction.create({
      data: {
        householdId,
        actionType: 'log_edit',
        actorId: ctx.user.id,
        targetType: 'purchase_log',
        targetId: id,
        purchaseLogId: id,
        reason: body.reason ?? null,
        metadata: JSON.stringify(updates),
      },
    })
  }

  return NextResponse.json({
    log: serializeLog({
      id: updated.id, itemId: updated.itemId, itemTitle: updated.itemTitle, buyerId: updated.buyerId,
      buyer: updated.buyer, pointTier: updated.pointTier, pointsAwarded: updated.pointsAwarded,
      purchasedAt: updated.purchasedAt, status: updated.status, deletedAt: updated.deletedAt,
    }),
  })
}

interface DeleteBody {
  confirm?: boolean
  hard?: boolean
  reason?: string
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  let body: DeleteBody = {}
  try {
    body = (await req.json().catch(() => ({}))) as DeleteBody
  } catch {
    body = {}
  }

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })

  if (log.householdId !== null) {
    if (!ctx.household || log.householdId !== ctx.household.id)
      return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })
  }

  const householdId = ctx.household?.id ?? null

  // Same permission gate as PATCH: own log within 24h free, else MODERATOR+.
  const isOwnLog = ctx.profile?.id === log.buyerId
  const withinWindow = (Date.now() - log.purchasedAt.getTime()) <= EDIT_WINDOW_MS
  const isStaff = ctx.role === 'OWNER' || ctx.role === 'MODERATOR'

  if (!isStaff) {
    if (!isOwnLog)
      return NextResponse.json({ error: 'فقط خریدار یا مدیر می‌توانند رکورد را حذف کنند' }, { status: 403 })
    if (!withinWindow)
      return NextResponse.json({ error: 'حذف فقط تا ۲۴ ساعت پس از خرید مجاز است' }, { status: 403 })
  }

  const hard = body.hard === true

  if (hard) {
    if (ctx.role !== 'OWNER')
      return NextResponse.json({ error: 'حذف کامل فقط توسط مدیر اصلی امکان‌پذیر است' }, { status: 403 })
    await db.purchaseLog.delete({ where: { id } })
  } else {
    await db.purchaseLog.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  // Audit both soft + hard deletes.
  if (householdId) {
    await db.moderationAction.create({
      data: {
        householdId,
        actionType: hard ? 'log_delete_hard' : 'log_delete',
        actorId: ctx.user.id,
        targetType: 'purchase_log',
        targetId: id,
        purchaseLogId: hard ? null : id,
        reason: body.reason ?? null,
      },
    })
  }

  return NextResponse.json({ ok: true, hard })
}
