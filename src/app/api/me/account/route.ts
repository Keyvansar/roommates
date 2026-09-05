import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, clearSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface AccountDeleteBody {
  confirm?: string
}

export async function DELETE(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  let body: AccountDeleteBody
  try {
    body = (await req.json()) as AccountDeleteBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  if (body.confirm !== 'DELETE')
    return NextResponse.json({ error: 'تأیید حذف لازم است' }, { status: 400 })

  const userId = ctx.user.id

  // In every household the user belongs to (other than ones they own),
  // reassign their purchase logs + items they last-bought to that
  // household's OWNER profile. (Owned households are deleted entirely
  // via the cascade below, so we skip them here.)
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { household: true },
  })

  await db.$transaction(async (tx) => {
    for (const m of memberships) {
      // Skip owned households — they will be cascade-deleted below.
      if (m.household.ownerId === userId) continue

      const ownerProfile = await tx.profile.findFirst({
        where: { householdId: m.householdId, userId: m.household.ownerId },
      })

      const leaverProfile = await tx.profile.findFirst({
        where: { householdId: m.householdId, userId },
      })

      if (leaverProfile) {
        if (ownerProfile) {
          await tx.purchaseLog.updateMany({
            where: { buyerId: leaverProfile.id },
            data: { buyerId: ownerProfile.id },
          })
          await tx.item.updateMany({
            where: { lastBoughtById: leaverProfile.id },
            data: { lastBoughtById: ownerProfile.id },
          })
        }
        await tx.flag.deleteMany({ where: { reporterId: leaverProfile.id } })
        await tx.profile.delete({ where: { id: leaverProfile.id } })
      }
    }

    // Delete every household owned by this user — the schema cascades
    // memberships, profiles, settings, categories, items, logs, flags,
    // and moderation actions for those households.
    await tx.household.deleteMany({ where: { ownerId: userId } })

    // Any leftover memberships (non-owned) are cleaned up explicitly —
    // the cascade would already have removed them via the household
    // deletes above, but this is a safety net.
    await tx.membership.deleteMany({ where: { userId } })

    // Sessions + moderation actions performed by the user.
    await tx.session.deleteMany({ where: { userId } })
    await tx.moderationAction.deleteMany({ where: { actorId: userId } })

    // Finally, delete the user.
    await tx.user.delete({ where: { id: userId } })
  })

  await clearSessionCookie()

  return NextResponse.json({ ok: true })
}
