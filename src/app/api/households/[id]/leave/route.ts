import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, createSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  // Verify the user is a member of the requested household.
  const membership = await db.membership.findUnique({
    where: { userId_householdId: { userId: ctx.user.id, householdId: id } },
  })
  if (!membership) return NextResponse.json({ error: 'شما عضو این خانه نیستید' }, { status: 404 })

  if (membership.role === 'OWNER')
    return NextResponse.json({ error: 'مدیر نمی‌تواند خانه را ترک کند؛ ابتدا مالکیت را منتقل کنید یا خانه را حذف کنید' }, { status: 400 })

  // Find the OWNER's profile in this household to reassign logs to.
  const household = await db.household.findUnique({ where: { id } })
  if (!household) return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  const ownerProfile = await db.profile.findFirst({
    where: { householdId: id, userId: household.ownerId },
  })

  const leaverProfile = await db.profile.findFirst({
    where: { householdId: id, userId: ctx.user.id },
  })

  if (leaverProfile) {
    if (ownerProfile) {
      await db.purchaseLog.updateMany({
        where: { buyerId: leaverProfile.id },
        data: { buyerId: ownerProfile.id },
      })
      await db.item.updateMany({
        where: { lastBoughtById: leaverProfile.id },
        data: { lastBoughtById: ownerProfile.id },
      })
    }
    await db.flag.deleteMany({ where: { reporterId: leaverProfile.id } })
    await db.profile.delete({ where: { id: leaverProfile.id } })
  }

  await db.membership.delete({ where: { id: membership.id } })

  // Switch the active session to the next household the user is still a
  // member of (oldest first), or set to null if no other memberships exist.
  const next = await db.membership.findFirst({
    where: { userId: ctx.user.id },
    orderBy: { joinedAt: 'asc' },
  })
  const switchedTo = next?.householdId ?? null

  const session = await createSession(ctx.user.id, switchedTo ?? undefined)
  await setSessionCookie(session.token)

  return NextResponse.json({ ok: true, switchedTo })
}
