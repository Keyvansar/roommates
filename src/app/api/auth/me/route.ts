import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCurrentUser({ withHousehold: true })

  if (!ctx) {
    // Anonymous / demo mode — return an unauthenticated envelope so the
    // frontend can fall back to the demo catalog (householdId = null).
    return NextResponse.json({ user: null, household: null, role: null, profile: null, households: [], profiles: [] })
  }

  const { user, household, membership, role, profile } = ctx

  // All of the user's memberships — used by the household switcher.
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: 'asc' },
    include: { household: true },
  })
  const households = memberships
    .filter((m) => m.household !== null)
    .map((m) => ({
      id: m.household!.id,
      name: m.household!.name,
      inviteCode: m.household!.inviteCode,
      ownerId: m.household!.ownerId,
      role: m.role,
      isOwner: m.role === 'OWNER',
      isActive: household !== null && m.householdId === household.id,
    }))

  // Profiles for the active household — each tagged with role + isMe.
  let profiles: Array<{
    id: string
    name: string
    avatarColor: string
    avatarEmoji: string | null
    userId: string | null
    role: string
    isMe: boolean
  }> = []

  if (household) {
    const houseProfiles = await db.profile.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: 'asc' },
    })
    const roleByUserId = new Map<string, string>()
    for (const m of memberships.filter((m) => m.householdId === household.id)) {
      roleByUserId.set(m.userId, m.role)
    }
    profiles = houseProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      avatarEmoji: p.avatarEmoji,
      userId: p.userId,
      role: p.userId ? (roleByUserId.get(p.userId) ?? 'MEMBER') : 'MEMBER',
      isMe: p.userId === user.id,
    }))
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatarColor,
      avatarEmoji: user.avatarEmoji,
    },
    household: household
      ? {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          ownerId: household.ownerId,
        }
      : null,
    role,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          avatarColor: profile.avatarColor,
          avatarEmoji: profile.avatarEmoji,
        }
      : null,
    households,
    profiles,
  })
}
