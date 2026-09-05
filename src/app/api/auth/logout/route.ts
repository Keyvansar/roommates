import { NextResponse } from 'next/server'
import { readSessionToken, deleteSession, clearSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const token = await readSessionToken()
  if (token) await deleteSession(token)
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
