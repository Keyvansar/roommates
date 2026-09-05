import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, createSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  const household = await db.household.findUnique({ where: { id } })
  if (!household) return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  if (household.ownerId !== ctx.user.id)
    return NextResponse.json({ error: 'فقط مدیر می‌تواند خانه را حذف کند' }, { status: 403 })

  // Cascade delete handled at the Prisma schema level: memberships,
  // profiles, settings, categories, items, purchase logs, flags, and
  // moderation actions all cascade on household deletion.
  await db.household.delete({ where: { id } })

  // Switch the active session to the next remaining household the user is
  // a member of (oldest first), or null if they have no other memberships.
  const next = await db.membership.findFirst({
    where: { userId: ctx.user.id },
    orderBy: { joinedAt: 'asc' },
  })
  const switchedTo = next?.householdId ?? null

  const session = await createSession(ctx.user.id, switchedTo ?? undefined)
  await setSessionCookie(session.token)

  return NextResponse.json({ ok: true, switchedTo })
}
