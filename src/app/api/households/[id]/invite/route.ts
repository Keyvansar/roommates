import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, newInviteCode } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  // Verify the requested household matches the user's active household —
  // members cannot regenerate invite codes for households they aren't in.
  if (!ctx.household || ctx.household.id !== id)
    return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  if (ctx.role !== 'OWNER' && ctx.role !== 'MODERATOR')
    return NextResponse.json({ error: 'اجازه انجام این عملیات را ندارید' }, { status: 403 })

  const inviteCode = newInviteCode()
  await db.household.update({ where: { id }, data: { inviteCode } })

  await db.moderationAction.create({
    data: {
      householdId: id,
      actionType: 'invite_regenerate',
      actorId: ctx.user.id,
      targetType: 'household',
      targetId: id,
    },
  })

  return NextResponse.json({ ok: true, inviteCode })
}
