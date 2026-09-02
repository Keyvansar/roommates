import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashPassword,
  createSession,
  setSessionCookie,
  newInviteCode,
  ensureProfileForUser,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Avatar color palette — cycled deterministically by user count so the
// second roommate in a household doesn't land on the same color as the
// first. Keeps the dashboard avatars visually distinct.
export const AVATAR_COLORS = [
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#0891b2', // cyan-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#ca8a04', // yellow-600
]

export function pickColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

const HOUSEHOLD_CAPACITY = 2
const MAX_OWNED_HOUSEHOLDS = 5

interface SignupBody {
  name?: string
  email?: string
  password?: string
  householdName?: string
  inviteCode?: string
}

export async function POST(req: NextRequest) {
  let body: SignupBody
  try {
    body = (await req.json()) as SignupBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const householdName = (body.householdName ?? '').trim()
  const inviteCode = (body.inviteCode ?? '').trim().toUpperCase()

  if (!name) return NextResponse.json({ error: 'نام را وارد کنید' }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'ایمیل معتبر وارد کنید' }, { status: 400 })
  if (password.length < 6)
    return NextResponse.json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, { status: 400 })

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'این ایمیل قبلاً ثبت شده' }, { status: 409 })

  const userCount = await db.user.count()
  const avatarColor = pickColor(userCount)

  const passwordHash = hashPassword(password)

  if (inviteCode) {
    // Join an existing household via invite code.
    const household = await db.household.findUnique({ where: { inviteCode } })
    if (!household) return NextResponse.json({ error: 'کد دعوت نامعتبر است' }, { status: 404 })

    const memberCount = await db.membership.count({ where: { householdId: household.id } })
    if (memberCount >= HOUSEHOLD_CAPACITY)
      return NextResponse.json({ error: 'ظرفیت خانه تکمیل است' }, { status: 409 })

    const user = await db.user.create({ data: { email, name, passwordHash, avatarColor } })
    await db.membership.create({
      data: { userId: user.id, householdId: household.id, role: 'MEMBER' },
    })
    // Re-pick color based on the household's existing member count so the
    // newcomer lands on a distinct color from existing members.
    const houseColor = pickColor(memberCount)
    if (houseColor !== avatarColor) {
      await db.user.update({ where: { id: user.id }, data: { avatarColor: houseColor } })
      user.avatarColor = houseColor
    }
    await ensureProfileForUser({ userId: user.id, householdId: household.id, name, avatarColor: user.avatarColor })

    // Make sure the household has a settings row.
    await db.householdSetting.upsert({
      where: { householdId: household.id },
      update: {},
      create: { householdId: household.id },
    })

    const session = await createSession(user.id, household.id)
    await setSessionCookie(session.token)

    return NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor }, householdId: household.id, role: 'MEMBER' },
      { status: 201 },
    )
  }

  // Create a brand new household as OWNER.
  if (!householdName)
    return NextResponse.json({ error: 'نام خانه را وارد کنید' }, { status: 400 })

  // Create the user first so we can compute the real owned-count below.
  const user = await db.user.create({ data: { email, name, passwordHash, avatarColor } })

  const ownedByUser = await db.household.count({ where: { ownerId: user.id } })
  if (ownedByUser >= MAX_OWNED_HOUSEHOLDS) {
    await db.user.delete({ where: { id: user.id } })
    return NextResponse.json({ error: 'حداکثر تعداد خانه‌ها ساخته شده' }, { status: 409 })
  }

  const household = await db.household.create({
    data: { name: householdName, ownerId: user.id, inviteCode: newInviteCode() },
  })
  await db.membership.create({ data: { userId: user.id, householdId: household.id, role: 'OWNER' } })
  await db.householdSetting.create({ data: { householdId: household.id } })
  await ensureProfileForUser({ userId: user.id, householdId: household.id, name, avatarColor: user.avatarColor })

  const session = await createSession(user.id, household.id)
  await setSessionCookie(session.token)

  return NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor }, householdId: household.id, role: 'OWNER' },
    { status: 201 },
  )
}
