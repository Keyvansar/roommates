import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, createSession, setSessionCookie, deleteSession, readSessionToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface SwitchBody {
  householdId?: string
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser()
  if (!ctx) return NextResponse.json({ error: 'برای تغییر خانه باید وارد شوید' }, { status: 401 })

  let body: SwitchBody
  try {
    body = (await req.json()) as SwitchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const householdId = body.householdId
  if (!householdId) return NextResponse.json({ error: 'شناسه خانه را وارد کنید' }, { status: 400 })

  const membership = await db.membership.findUnique({
    where: { userId_householdId: { userId: ctx.user.id, householdId } },
  })
  if (!membership) return NextResponse.json({ error: 'شما عضو این خانه نیستید' }, { status: 403 })

  const household = await db.household.findUnique({ where: { id: householdId } })
  if (!household) return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  // SECURITY FIX: Delete the old session before creating a new one to prevent session accumulation
  const oldToken = await readSessionToken()
  if (oldToken) await deleteSession(oldToken)

  const session = await createSession(ctx.user.id, householdId)
  await setSessionCookie(session.token)

  return NextResponse.json({
    ok: true,
    household: { id: household.id, name: household.name, inviteCode: household.inviteCode, ownerId: household.ownerId },
    role: membership.role,
  })
}
