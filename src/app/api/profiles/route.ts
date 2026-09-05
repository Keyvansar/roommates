import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCurrentUser({ withHousehold: true })

  // Anonymous / demo mode: return the global demo profiles (householdId
  // null) so the catalog-only preview still has someone to assign logs to.
  if (!ctx || !ctx.household) {
    const demoProfiles = await db.profile.findMany({
      where: { householdId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, avatarColor: true, pin: true },
    })
    return NextResponse.json({
      profiles: demoProfiles.map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor, pin: p.pin })),
    })
  }

  const profiles = await db.profile.findMany({
    where: { householdId: ctx.household.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, avatarColor: true, pin: true },
  })

  return NextResponse.json({
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor, pin: p.pin })),
  })
}
