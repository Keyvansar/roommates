'use client'

import { useMemo } from 'react'
import { useHouseholdSettings } from '@/hooks/use-auth'
import { useUserStore } from '@/lib/store'
import { TIER_META, type PointTier } from '@/lib/types'

const DEFAULT_TIER_LABELS: Record<string, string> = {
  '1': 'سبک',
  '3': 'متوسط',
  '5': 'سنگین',
}

/**
 * Returns the tier metadata (label / points / color) merged with the
 * household-level tierLabels override. Falls back to the built-in defaults.
 */
export function useTierMeta(): Record<PointTier, { label: string; points: number; color: string }> {
  const household = useUserStore((s) => s.household)
  const householdId = household?.id ?? null
  const { data } = useHouseholdSettings(householdId)
  const tierLabels = data?.tierLabels ?? null

  return useMemo(() => {
    const labels = { ...DEFAULT_TIER_LABELS, ...(tierLabels ?? {}) }
    return {
      1: { label: labels['1'] ?? TIER_META[1].label, points: TIER_META[1].points, color: TIER_META[1].color },
      3: { label: labels['3'] ?? TIER_META[3].label, points: TIER_META[3].points, color: TIER_META[3].color },
      5: { label: labels['5'] ?? TIER_META[5].label, points: TIER_META[5].points, color: TIER_META[5].color },
    }
  }, [tierLabels])
}
