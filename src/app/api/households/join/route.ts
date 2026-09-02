import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, ensureProfileForUser, createSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const HOUSEHOLD_CAPACITY = 2

interface JoinBody {
  inviteCode?: string
  name?: string
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser()
  if (!ctx) return NextResponse.json({ error: 'برای پیوستن به خانه باید وارد شوید' }, { status: 401 })

  let body: JoinBody
  try {
    body = (await req.json()) as JoinBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const inviteCode = (body.inviteCode ?? '').trim().toUpperCase()
  if (!inviteCode) return NextResponse.json({ error: 'کد دعوت را وارد کنید' }, { status: 400 })

  const household = await db.household.findUnique({ where: { inviteCode } })
  if (!household) return NextResponse.json({ error: 'کد دعوت نامعتبر است' }, { status: 404 })

  // If the user is already a member, just switch their active household.
  const existing = await db.membership.findUnique({
    where: { userId_householdId: { userId: ctx.user.id, householdId: household.id } },
  })
  if (existing) {
    const session = await createSession(ctx.user.id, household.id)
    await setSessionCookie(session.token)
    return NextResponse.json({
      ok: true,
      household: { id: household.id, name: household.name, inviteCode: household.inviteCode },
    })
  }

  const memberCount = await db.membership.count({ where: { householdId: household.id } })
  if (memberCount >= HOUSEHOLD_CAPACITY)
    return NextResponse.json({ error: 'ظرفیت خانه تکمیل است' }, { status: 409 })

  await db.membership.create({
    data: { userId: ctx.user.id, householdId: household.id, role: 'MEMBER' },
  })
  await ensureProfileForUser({
    userId: ctx.user.id,
    householdId: household.id,
    name: body.name?.trim() || ctx.user.name,
    avatarColor: ctx.user.avatarColor,
  })

  const session = await createSession(ctx.user.id, household.id)
  await setSessionCookie(session.token)

  return NextResponse.json(
    { ok: true, household: { id: household.id, name: household.name, inviteCode: household.inviteCode } },
    { status: 201 },
  )
}
