import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RejectBody {
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

  let body: RejectBody
  try {
    body = (await req.json()) as RejectBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const reason = (body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ error: 'دلیل رد الزامی است' }, { status: 400 })

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (log.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })

  await db.$transaction([
    db.purchaseLog.update({ where: { id }, data: { status: 'rejected', deletedAt: new Date() } }),
    db.flag.updateMany({
      where: { purchaseLogId: id, status: 'open' },
      data: { status: 'resolved', resolvedAt: new Date(), resolvedById: ctx.user.id },
    }),
    db.moderationAction.create({
      data: {
        householdId: ctx.household.id,
        actionType: 'log_reject',
        actorId: ctx.user.id,
        targetType: 'purchase_log',
        targetId: id,
        purchaseLogId: id,
        reason,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
