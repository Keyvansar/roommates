import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import type { PointTier } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_TIERS: PointTier[] = [1, 3, 5]
const TIER_POINTS: Record<number, number> = { 1: 1, 3: 3, 5: 5 }

interface ResolveBody {
  newTier?: PointTier
  reason?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  if (!ctx.household) return NextResponse.json({ error: 'خانه فعال یافت نشد' }, { status: 404 })
  if (ctx.role !== 'OWNER')
    return NextResponse.json({ error: 'این اقدام فقط توسط مدیر اصلی ممکن است' }, { status: 403 })

  let body: ResolveBody = {}
  try {
    body = (await req.json().catch(() => ({}))) as ResolveBody
  } catch {
    body = {}
  }

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (log.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })

  const updates: { pointTier?: number; pointsAwarded?: number; status?: string } = {}
  if (body.newTier !== undefined) {
    if (!VALID_TIERS.includes(body.newTier))
      return NextResponse.json({ error: 'تیر امتیاز نامعتبر است' }, { status: 400 })
    updates.pointTier = body.newTier
    updates.pointsAwarded = TIER_POINTS[body.newTier] ?? body.newTier
  }
  // Always re-approve the log + resolve its open flags.
  updates.status = 'approved'

  await db.$transaction([
    db.purchaseLog.update({ where: { id }, data: updates }),
    db.flag.updateMany({
      where: { purchaseLogId: id, status: 'open' },
      data: { status: 'resolved', resolvedAt: new Date(), resolvedById: ctx.user.id },
    }),
    db.moderationAction.create({
      data: {
        householdId: ctx.household.id,
        actionType: 'log_resolve',
        actorId: ctx.user.id,
        targetType: 'purchase_log',
        targetId: id,
        purchaseLogId: id,
        reason: body.reason ?? null,
        metadata: JSON.stringify(updates),
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
