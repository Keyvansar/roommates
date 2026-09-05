import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  if (!ctx.household) return NextResponse.json({ error: 'خانه فعال یافت نشد' }, { status: 404 })
  if (ctx.role !== 'OWNER')
    return NextResponse.json({ error: 'این اقدام فقط توسط مدیر اصلی ممکن است' }, { status: 403 })

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (log.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })

  if (!log.deletedAt)
    return NextResponse.json({ error: 'این رکورد حذف نشده است' }, { status: 400 })

  // Only allow restoration within 7 days of soft-delete.
  if (Date.now() - log.deletedAt.getTime() > RESTORE_WINDOW_MS)
    return NextResponse.json({ error: 'بازه ۷ روزه برای بازیابی به سر رسیده است' }, { status: 400 })

  await db.$transaction([
    db.purchaseLog.update({
      where: { id },
      data: { deletedAt: null, status: log.status === 'rejected' ? 'approved' : log.status },
    }),
    db.moderationAction.create({
      data: {
        householdId: ctx.household.id,
        actionType: 'log_restore',
        actorId: ctx.user.id,
        targetType: 'purchase_log',
        targetId: id,
        purchaseLogId: id,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
