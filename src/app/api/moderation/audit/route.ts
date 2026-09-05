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
  const actionType = url.searchParams.get('actionType')
  const limitParam = Number(url.searchParams.get('limit') ?? '100')
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitParam) ? limitParam : 100))

  const where: { householdId: string; actionType?: string } = { householdId: ctx.household.id }
  if (actionType) where.actionType = actionType

  const actions = await db.moderationAction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { id: true, name: true, avatarColor: true, avatarEmoji: true } } },
  })

  return NextResponse.json({
    actions: actions.map((a) => ({
      id: a.id,
      householdId: a.householdId,
      actionType: a.actionType,
      actorId: a.actorId,
      actor: {
        id: a.actor.id,
        name: a.actor.name,
        avatarColor: a.actor.avatarColor,
        avatarEmoji: a.actor.avatarEmoji ?? null,
      },
      targetType: a.targetType,
      targetId: a.targetId,
      reason: a.reason,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
      purchaseLogId: a.purchaseLogId,
    })),
  })
}
