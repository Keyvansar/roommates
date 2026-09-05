import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface ApproveBody {
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
  if (ctx.role !== 'OWNER' && ctx.role !== 'MODERATOR')
    return NextResponse.json({ error: 'این اقدام فقط توسط مدیر یا مدیر اصلی ممکن است' }, { status: 403 })

  let body: ApproveBody = {}
  try {
    body = (await req.json().catch(() => ({}))) as ApproveBody
  } catch {
    body = {}
  }

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (log.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })

  if (log.status !== 'flagged')
    return NextResponse.json({ error: 'این رکورد در حالت گزارش‌شده نیست' }, { status: 400 })

  await db.$transaction([
    db.purchaseLog.update({ where: { id }, data: { status: 'approved' } }),
    db.flag.updateMany({
      where: { purchaseLogId: id, status: 'open' },
      data: { status: 'dismissed', resolvedAt: new Date(), resolvedById: ctx.user.id },
    }),
    db.moderationAction.create({
      data: {
        householdId: ctx.household.id,
        actionType: 'log_approve',
        actorId: ctx.user.id,
        targetType: 'purchase_log',
        targetId: id,
        purchaseLogId: id,
        reason: body.reason ?? null,
      },
    }),
  ])

  return NextResponse.json({ ok: true, status: 'approved' })
}
