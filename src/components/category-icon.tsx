'use client'

import {
  Apple,
  Bath,
  Battery,
  Beef,
  Brush,
  Carrot,
  Coffee,
  Cookie,
  Egg,
  Flower2,
  Hammer,
  Leaf,
  Lightbulb,
  Milk,
  Package,
  Pencil,
  PiggyBank,
  Pizza,
  Refrigerator,
  Salad,
  Sandwich,
  ShoppingBasket,
  Sparkles,
  SprayCan,
  Trash2,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react'

/**
 * Mapping from the icon name stored on a `CategoryDTO` to the actual lucide
 * component. Categories pick their icon name from this list when they're
 * created / edited; the API stores the string, and this module is the single
 * place that knows how to render that string back into an icon.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Refrigerator,
  Beef,
  Apple,
  Cookie,
  Package,
  ShoppingBasket,
  Coffee,
  Wine,
  Utensils,
  Bath,
  Trash2,
  Carrot,
  Egg,
  Sandwich,
  Milk,
  Flower2,
  Leaf,
  SprayCan,
  Brush,
  PiggyBank,
  Pencil,
  Hammer,
  Lightbulb,
  Battery,
  Salad,
  Pizza,
}

/**
 * Flat list of icon names — handy for the category editor's icon picker so
 * downstream agents don't have to rebuild it from the map.
 */
export const CATEGORY_ICON_LIST: string[] = Object.keys(CATEGORY_ICONS)

const FALLBACK_ICON = ShoppingBasket

export interface CategoryIconProps {
  /** Icon name as stored on the category (e.g. "Refrigerator"). */
  name: string | null | undefined
  className?: string
  /** Pixel size — defaults to 20 to match a typical list icon. */
  size?: number
  /** Optional accessible label. Falls back to the icon name. */
  'aria-label'?: string
}

/**
 * Renders a category icon by name. Falls back to `ShoppingBasket` when the
 * name is missing or not in the catalog so the UI never breaks.
 */
export function CategoryIcon({ name, className, size = 20, 'aria-label': ariaLabel }: CategoryIconProps) {
  const Icon = (name && CATEGORY_ICONS[name]) || FALLBACK_ICON
  return <Icon className={className} size={size} aria-label={ariaLabel ?? name ?? undefined} />
}
