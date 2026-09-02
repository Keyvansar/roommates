// Server-only auth helpers: password hashing (scrypt), session token generation,
// cookie management, and getCurrentUser().

import { cookies } from 'next/headers'
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import type { User, Household, Membership, Profile, Session } from '@prisma/client'

export const SESSION_COOKIE = 'hamkhaneh_session'
const SESSION_TTL_DAYS = 30

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = parts[1]
  const hash = parts[2]
  const candidate = scryptSync(plain, salt, 64)
  const candidateHex = candidate.toString('hex')
  if (candidateHex.length !== hash.length) return false
  try {
    return timingSafeEqual(Buffer.from(candidateHex, 'hex'), Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

function newToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(userId: string, activeHouseholdId?: string): Promise<Session> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)
  const token = newToken()
  return db.session.create({
    data: { token, userId, expiresAt, activeHouseholdId: activeHouseholdId ?? null },
  })
}

export async function deleteSession(token: string): Promise<void> {
  try { await db.session.delete({ where: { token } }) } catch { /* already deleted */ }
}

export async function setSessionCookie(token: string) {
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', expires,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value
}

export interface AuthContext {
  user: User
  household: Household | null
  membership: Membership | null
  role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  profile: Profile | null
}

export async function getCurrentUser(opts?: { withHousehold?: boolean }): Promise<AuthContext | null> {
  const token = await readSessionToken()
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!session) { await clearSessionCookie(); return null }
  if (session.expiresAt < new Date()) {
    await deleteSession(token)
    await clearSessionCookie()
    return null
  }

  void db.user.update({ where: { id: session.user.id }, data: { lastSeenAt: new Date() } })

  if (!opts?.withHousehold) {
    return { user: session.user, household: null, membership: null, role: null, profile: null }
  }

  let activeHouseholdId = session.activeHouseholdId
  let membership: Membership | null = null

  if (!activeHouseholdId) {
    const first = await db.membership.findFirst({ where: { userId: session.user.id }, orderBy: { joinedAt: 'asc' } })
    if (first) { activeHouseholdId = first.householdId; membership = first }
  } else {
    membership = await db.membership.findUnique({
      where: { userId_householdId: { userId: session.user.id, householdId: activeHouseholdId } },
    })
    if (!membership) {
      const first = await db.membership.findFirst({ where: { userId: session.user.id }, orderBy: { joinedAt: 'asc' } })
      if (first) { activeHouseholdId = first.householdId; membership = first }
    }
  }

  if (!activeHouseholdId || !membership) {
    return { user: session.user, household: null, membership: null, role: null, profile: null }
  }

  const household = await db.household.findUnique({ where: { id: activeHouseholdId } })
  if (!household) return { user: session.user, household: null, membership: null, role: null, profile: null }

  const profile = await db.profile.findFirst({
    where: { userId: session.user.id, householdId: activeHouseholdId },
  })

  return { user: session.user, household, membership, role: membership.role as 'OWNER' | 'MODERATOR' | 'MEMBER', profile }
}

export function newInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = randomBytes(6)
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length]
  return out
}

export async function ensureProfileForUser(opts: { userId: string; householdId: string; name: string; avatarColor: string }): Promise<Profile> {
  const existing = await db.profile.findFirst({ where: { userId: opts.userId, householdId: opts.householdId } })
  if (existing) return existing
  return db.profile.create({ data: { userId: opts.userId, householdId: opts.householdId, name: opts.name, avatarColor: opts.avatarColor } })
}

export { hashPassword }
