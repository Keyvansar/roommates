import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { computeBalance } from '@/lib/api-serializers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCurrentUser({ withHousehold: true })
  const householdId = ctx?.household?.id ?? null
  const balance = await computeBalance(householdId)
  return NextResponse.json({ balance })
}
