import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VALID_TIER_KEYS = ['1', '3', '5'] as const
const VALID_THEMES = ['system', 'light', 'dark'] as const

function parseTierLabels(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      const out: Record<string, string> = {}
      for (const key of VALID_TIER_KEYS) {
        const v = obj[key]
        if (typeof v === 'string' && v.trim()) out[key] = v.trim()
      }
      return out
    }
    return null
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  if (!ctx.household || ctx.household.id !== id)
    return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  const settings = await db.householdSetting.findUnique({ where: { householdId: id } })
  const tierLabels = parseTierLabels(settings?.tierLabels)
  return NextResponse.json({
    tierLabels,
    autoApprove: settings?.autoApprove ?? false,
    theme: settings?.theme ?? 'system',
  })
}

interface PatchBody {
  tierLabels?: Record<string, string> | null
  autoApprove?: boolean
  theme?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  if (!ctx.household || ctx.household.id !== id)
    return NextResponse.json({ error: 'خانه یافت نشد' }, { status: 404 })

  if (ctx.role !== 'OWNER' && ctx.role !== 'MODERATOR')
    return NextResponse.json({ error: 'اجازه ویرایش تنظیمات را ندارید' }, { status: 403 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const data: { tierLabels?: string | null; autoApprove?: boolean; theme?: string } = {}

  if (body.tierLabels !== undefined) {
    if (body.tierLabels === null) {
      data.tierLabels = null
    } else if (typeof body.tierLabels === 'object') {
      // Validate the keys — only 1/3/5 are accepted.
      const cleaned: Record<string, string> = {}
      for (const key of VALID_TIER_KEYS) {
        const v = body.tierLabels[key]
        if (typeof v === 'string' && v.trim()) cleaned[key] = v.trim()
      }
      // If no valid keys provided, treat as null (reset to defaults).
      data.tierLabels = Object.keys(cleaned).length ? JSON.stringify(cleaned) : null
    } else {
      return NextResponse.json({ error: 'tierLabels باید یک آبجکت باشد' }, { status: 400 })
    }
  }

  if (body.autoApprove !== undefined) {
    if (typeof body.autoApprove !== 'boolean')
      return NextResponse.json({ error: 'autoApprove باید بولین باشد' }, { status: 400 })
    data.autoApprove = body.autoApprove
  }

  if (body.theme !== undefined) {
    if (!VALID_THEMES.includes(body.theme as (typeof VALID_THEMES)[number]))
      return NextResponse.json({ error: 'theme معتبر نیست' }, { status: 400 })
    data.theme = body.theme
  }

  const settings = await db.householdSetting.upsert({
    where: { householdId: id },
    update: data,
    create: {
      householdId: id,
      tierLabels: data.tierLabels ?? null,
      autoApprove: data.autoApprove ?? false,
      theme: data.theme ?? 'system',
    },
  })

  await db.moderationAction.create({
    data: {
      householdId: id,
      actionType: 'settings_update',
      actorId: ctx.user.id,
      targetType: 'household_settings',
      targetId: id,
      metadata: JSON.stringify(data),
    },
  })

  return NextResponse.json({
    ok: true,
    tierLabels: parseTierLabels(settings.tierLabels),
    autoApprove: settings.autoApprove,
    theme: settings.theme,
  })
}
