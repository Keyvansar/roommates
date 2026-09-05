import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface PatchBody {
  role?: 'MEMBER' | 'MODERATOR'
  transferOwnership?: boolean
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  if (!ctx.household || ctx.household.id !== id)
    return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  if (ctx.role !== 'OWNER')
    return NextResponse.json({ error: 'فقط مدیر می‌تواند نقش‌ها را تغییر دهد' }, { status: 403 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const targetMembership = await db.membership.findUnique({
    where: { userId_householdId: { userId, householdId: id } },
  })
  if (!targetMembership) return NextResponse.json({ error: 'کاربر عضو این خانه نیست' }, { status: 404 })

  if (userId === ctx.user.id && !body.transferOwnership)
    return NextResponse.json({ error: 'نمی‌توانید نقش خود را تغییر دهید' }, { status: 400 })

  // Ownership transfer: atomic — demote self to MEMBER, promote target to
  // OWNER, update household.ownerId.
  if (body.transferOwnership) {
    if (userId === ctx.user.id)
      return NextResponse.json({ error: 'انتقال به خود خودتان بی‌معناست' }, { status: 400 })
    if (targetMembership.role === 'OWNER')
      return NextResponse.json({ error: 'این کاربر مدیر فعلی است' }, { status: 400 })

    await db.$transaction([
      db.membership.update({
        where: { userId_householdId: { userId: ctx.user.id, householdId: id } },
        data: { role: 'MEMBER' },
      }),
      db.membership.update({
        where: { userId_householdId: { userId, householdId: id } },
        data: { role: 'OWNER' },
      }),
      db.household.update({ where: { id }, data: { ownerId: userId } }),
    ])

    await db.moderationAction.create({
      data: {
        householdId: id,
        actionType: 'ownership_transfer',
        actorId: ctx.user.id,
        targetType: 'membership',
        targetId: userId,
      },
    })

    return NextResponse.json({ ok: true, role: 'OWNER', transferred: true })
  }

  if (body.role !== 'MEMBER' && body.role !== 'MODERATOR')
    return NextResponse.json({ error: 'نقش نامعتبر است' }, { status: 400 })

  if (targetMembership.role === 'OWNER')
    return NextResponse.json({ error: 'نمی‌توان نقش مدیر را تغییر داد' }, { status: 400 })

  await db.membership.update({
    where: { userId_householdId: { userId, householdId: id } },
    data: { role: body.role },
  })

  await db.moderationAction.create({
    data: {
      householdId: id,
      actionType: 'role_change',
      actorId: ctx.user.id,
      targetType: 'membership',
      targetId: userId,
      metadata: JSON.stringify({ role: body.role }),
    },
  })

  return NextResponse.json({ ok: true, role: body.role, transferred: false })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  if (!ctx.household || ctx.household.id !== id)
    return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  if (ctx.role !== 'OWNER')
    return NextResponse.json({ error: 'فقط مدیر می‌تواند اعضا را حذف کند' }, { status: 403 })

  if (userId === ctx.user.id)
    return NextResponse.json({ error: 'برای حذف خود از خانه از قابلیت «ترک خانه» استفاده کنید' }, { status: 400 })

  const target = await db.membership.findUnique({
    where: { userId_householdId: { userId, householdId: id } },
  })
  if (!target) return NextResponse.json({ error: 'کاربر عضو این خانه نیست' }, { status: 404 })
  if (target.role === 'OWNER')
    return NextResponse.json({ error: 'نمی‌توان مدیر را از خانه حذف کرد' }, { status: 400 })

  // Reassign their purchase logs + items they last-bought to the OWNER's
  // profile in this household, then delete their flags + profile + membership.
  const ownerProfile = await db.profile.findFirst({
    where: { householdId: id, userId: ctx.user.id },
  })
  if (!ownerProfile) {
    return NextResponse.json({ error: 'پروفایل مدیر یافت نشد' }, { status: 500 })
  }

  // Fetch the target's profile in this household.
  const targetProfile = await db.profile.findFirst({
    where: { householdId: id, userId },
  })

  if (targetProfile) {
    await db.purchaseLog.updateMany({
      where: { buyerId: targetProfile.id },
      data: { buyerId: ownerProfile.id },
    })
    await db.item.updateMany({
      where: { lastBoughtById: targetProfile.id },
      data: { lastBoughtById: ownerProfile.id },
    })
    await db.flag.deleteMany({ where: { reporterId: targetProfile.id } })
    await db.profile.delete({ where: { id: targetProfile.id } })
  }

  await db.membership.delete({ where: { id: target.id } })

  await db.moderationAction.create({
    data: {
      householdId: id,
      actionType: 'member_remove',
      actorId: ctx.user.id,
      targetType: 'membership',
      targetId: userId,
    },
  })

  return NextResponse.json({ ok: true })
}
