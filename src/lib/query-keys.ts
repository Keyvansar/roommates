export const qk = {
  profiles: ['profiles'] as const,
  categories: ['categories'] as const,
  items: ['items'] as const,
  itemsByStatus: (status: string) => ['items', { status }] as const,
  logs: ['purchase-logs'] as const,
  balance: ['balance'] as const,
  stats: ['stats'] as const,
}
