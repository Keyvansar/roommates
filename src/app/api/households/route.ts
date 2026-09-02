import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, newInviteCode, ensureProfileForUser, createSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_OWNED_HOUSEHOLDS = 5

interface CreateBody {
  name?: string
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser()
  if (!ctx) return NextResponse.json({ error: 'برای ساخت خانه باید وارد شوید' }, { status: 401 })

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'نام خانه را وارد کنید' }, { status: 400 })

  const ownedCount = await db.household.count({ where: { ownerId: ctx.user.id } })
  if (ownedCount >= MAX_OWNED_HOUSEHOLDS)
    return NextResponse.json({ error: 'حداکثر تعداد خانه‌ها ساخته شده' }, { status: 409 })

  const household = await db.household.create({
    data: { name, ownerId: ctx.user.id, inviteCode: newInviteCode() },
  })
  await db.membership.create({ data: { userId: ctx.user.id, householdId: household.id, role: 'OWNER' } })
  await db.householdSetting.create({ data: { householdId: household.id } })
  await ensureProfileForUser({
    userId: ctx.user.id,
    householdId: household.id,
    name: ctx.user.name,
    avatarColor: ctx.user.avatarColor,
  })

  // Switch the active session to the newly created household.
  const session = await createSession(ctx.user.id, household.id)
  await setSessionCookie(session.token)

  return NextResponse.json(
    { ok: true, household: { id: household.id, name: household.name, inviteCode: household.inviteCode } },
    { status: 201 },
  )
}
