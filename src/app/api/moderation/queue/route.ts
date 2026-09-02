import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  if (!ctx.household) return NextResponse.json({ error: 'خانه فعال یافت نشد' }, { status: 404 })
  if (ctx.role !== 'OWNER' && ctx.role !== 'MODERATOR')
    return NextResponse.json({ error: 'این بخش فقط برای مدیر و مدیر اصلی قابل مشاهده است' }, { status: 403 })

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status') ?? 'open'

  const where: { householdId: string; status?: string } = { householdId: ctx.household.id }
  if (statusFilter !== 'all') where.status = statusFilter

  const flags = await db.flag.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      purchaseLog: {
        include: { buyer: { select: { id: true, name: true, avatarColor: true } } },
      },
      reporter: { select: { id: true, name: true, avatarColor: true } },
    },
  })

  return NextResponse.json({
    flags: flags.map((f) => ({
      id: f.id,
      householdId: f.householdId,
      purchaseLogId: f.purchaseLogId,
      reporterId: f.reporterId,
      reason: f.reason,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : null,
      resolvedById: f.resolvedById,
      purchaseLog: f.purchaseLog
        ? {
            id: f.purchaseLog.id,
            itemTitle: f.purchaseLog.itemTitle,
            pointTier: f.purchaseLog.pointTier,
            pointsAwarded: f.purchaseLog.pointsAwarded,
            purchasedAt: f.purchaseLog.purchasedAt.toISOString(),
            status: f.purchaseLog.status,
            deletedAt: f.purchaseLog.deletedAt ? f.purchaseLog.deletedAt.toISOString() : null,
            buyer: f.purchaseLog.buyer
              ? {
                  id: f.purchaseLog.buyer.id,
                  name: f.purchaseLog.buyer.name,
                  avatarColor: f.purchaseLog.buyer.avatarColor,
                }
              : null,
          }
        : null,
      reporter: f.reporter
        ? { id: f.reporter.id, name: f.reporter.name, avatarColor: f.reporter.avatarColor }
        : null,
    })),
  })
}
