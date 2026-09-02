'use client'

import { Badge } from '@/components/ui/badge'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import { STATUS_META, type ItemStatus, type PointTier } from '@/lib/types'

/**
 * Pill that shows a point tier: a coloured dot + the household's label +
 * the points value (rendered with Persian digits when enabled).
 *
 * The label and color come from `useTierMeta` so household-level tier label
 * overrides are honoured. The points value is formatted with `useFaDigits`.
 */
export function TierBadge({ tier, className }: { tier: PointTier; className?: string }) {
  const meta = useTierMeta()
  const fa = useFaDigits()
  const t = meta[tier]
  return (
    <Badge variant="outline" className={`gap-1.5 border-transparent bg-muted/60 ${className ?? ''}`}>
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: t.color }}
      />
      <span>{t.label}</span>
      <span className="text-muted-foreground tabular-nums">{fa(t.points)}</span>
    </Badge>
  )
}

/**
 * Pill that shows an item status using the labels + colors declared in
 * `STATUS_META`. Independent of household settings.
 */
export function StatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <Badge variant="outline" className={`gap-1.5 border-transparent bg-muted/60 ${className ?? ''}`}>
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      <span>{meta.label}</span>
    </Badge>
  )
}
