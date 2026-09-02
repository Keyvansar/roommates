// Typed API client for the Household Shopping PWA.
import type {
  ProfileDTO, ItemDTO, PurchaseLogDTO, BalanceDTO, CategoryDTO, ItemStatus, PointTier,
} from '@/lib/types'

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, cache: 'no-store' })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const body = await res.json(); msg = body?.error ?? msg } catch { /* */ }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Profiles
  listProfiles: () => http<{ profiles: ProfileDTO[] }>('/api/profiles').then((r) => r.profiles),

  // Categories
  listCategories: () => http<{ categories: CategoryDTO[] }>('/api/categories').then((r) => r.categories),
  createCategory: (data: { title: string; icon?: string; sortOrder?: number }) =>
    http<{ category: CategoryDTO }>('/api/categories', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.category),
  updateCategory: (id: string, data: { title?: string; icon?: string; sortOrder?: number }) =>
    http<{ category: CategoryDTO }>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.category),
  deleteCategory: (id: string, moveTo?: string) =>
    http<{ ok: boolean; movedItemsTo?: string }>(`/api/categories/${id}`, { method: 'DELETE', body: JSON.stringify({ moveTo }) }),

  // Items
  listItems: (params?: { status?: ItemStatus; categoryId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.categoryId) qs.set('categoryId', params.categoryId)
    const q = qs.toString()
    return http<{ items: ItemDTO[] }>(`/api/items${q ? `?${q}` : ''}`).then((r) => r.items)
  },
  createItem: (data: { title: string; categoryId: string; pointTier: PointTier; status?: ItemStatus }) =>
    http<{ item: ItemDTO }>('/api/items', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.item),
  updateItem: (id: string, data: { status?: ItemStatus; pointTier?: PointTier; title?: string }) =>
    http<{ item: ItemDTO }>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.item),
  deleteItem: (id: string) => http<{ ok: boolean }>(`/api/items/${id}`, { method: 'DELETE' }),

  // Purchase logs
  listLogs: (limit = 100, includeDeleted = false) =>
    http<{ logs: PurchaseLogDTO[] }>(`/api/purchase-logs?limit=${limit}${includeDeleted ? '&includeDeleted=true' : ''}`).then((r) => r.logs),
  checkout: (data: { itemId?: string; buyerId: string; pointTier?: PointTier; itemTitle?: string }) =>
    http<{ log: PurchaseLogDTO }>('/api/purchase-logs', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.log),
  updateLog: (id: string, data: { buyerId?: string; pointTier?: PointTier; itemTitle?: string }) =>
    http<{ log: PurchaseLogDTO }>(`/api/purchase-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.log),
  deleteLog: (id: string, opts?: { reason?: string; hard?: boolean }) =>
    http<{ ok: boolean }>(`/api/purchase-logs/${id}`, { method: 'DELETE', body: JSON.stringify({ confirm: true, reason: opts?.reason, hard: opts?.hard }) }),

  // Balance
  getBalance: () => http<{ balance: BalanceDTO }>('/api/balance').then((r) => r.balance),

  // Stats
  getStats: (range: 'all' | '3m' | '1m' = 'all') =>
    http<{
      totals: { purchases: number; points: number; items: number; activeDays: number }
      perProfile: Array<{ id: string; name: string; avatarColor: string; count: number; points: number }>
      perCategory: Array<{ id: string; title: string; icon: string; count: number; points: number }>
      perTier: Array<{ tier: number; count: number; points: number }>
      monthlyTrend: Array<{ key: string; label: string; count: number; points: number }>
      topItems: Array<{ itemTitle: string; count: number; points: number; buyerName: string; buyerColor: string }>
    }>(`/api/stats?range=${range}`),

  getCategoryStats: (categoryId: string, range: 'all' | '3m' | '1m' = 'all') =>
    http<{
      category: { id: string; title: string; icon: string }
      totals: { purchases: number; points: number; items: number }
      perItem: Array<{ itemTitle: string; count: number; points: number; lastBuyer: string | null; lastBuyerColor: string | null; lastAt: string | null }>
      perBuyer: Array<{ name: string; avatarColor: string; count: number; points: number }>
      recentLogs: Array<{ id: string; itemTitle: string; buyerName: string; buyerColor: string; pointTier: number; pointsAwarded: number; purchasedAt: string }>
    }>(`/api/stats/category?categoryId=${categoryId}&range=${range}`),

  getBuyerStats: (profileId: string, range: 'all' | '3m' | '1m' = 'all') =>
    http<{
      profile: { id: string; name: string; avatarColor: string; avatarEmoji: string | null }
      totals: { purchases: number; points: number; categories: number }
      perCategory: Array<{ id: string; title: string; icon: string; count: number; points: number }>
      perItem: Array<{ itemTitle: string; count: number; points: number; categoryTitle: string | null; lastAt: string | null }>
      perTier: Array<{ tier: number; count: number; points: number }>
      recentLogs: Array<{ id: string; itemTitle: string; pointTier: number; pointsAwarded: number; purchasedAt: string; categoryTitle: string | null }>
    }>(`/api/stats/buyer?profileId=${profileId}&range=${range}`),

  getTierStats: (tier: 1 | 3 | 5, range: 'all' | '3m' | '1m' = 'all') =>
    http<{
      tier: number
      totals: { purchases: number; points: number; items: number }
      perBuyer: Array<{ name: string; avatarColor: string; count: number; points: number }>
      perCategory: Array<{ id: string; title: string; icon: string; count: number; points: number }>
      perItem: Array<{ itemTitle: string; count: number; points: number; categoryTitle: string | null; lastBuyer: string | null; lastBuyerColor: string | null; lastAt: string | null }>
      recentLogs: Array<{ id: string; itemTitle: string; buyerName: string; buyerColor: string; pointsAwarded: number; purchasedAt: string; categoryTitle: string | null }>
    }>(`/api/stats/tier?tier=${tier}&range=${range}`),

  getWeeklyStats: () =>
    http<{
      thisWeek: { purchases: number; points: number; perBuyer: Array<{ name: string; avatarColor: string; count: number; points: number }> }
      lastWeek: { purchases: number; points: number }
      delta: number
      deltaPct: number
    }>('/api/stats/weekly'),

  // Demo reset
  reseed: () => http<{ ok: boolean }>('/api/seed', { method: 'POST', body: JSON.stringify({ confirm: true }) }),

  // Auth
  me: () => http<{
    user: { id: string; email: string; name: string; avatarColor: string; avatarEmoji: string | null } | null
    household: { id: string; name: string; inviteCode: string; ownerId: string } | null
    role: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
    profile: { id: string; name: string; avatarColor: string; avatarEmoji: string | null } | null
    households: Array<{ id: string; name: string; inviteCode: string; role: string; isOwner: boolean; isActive: boolean }>
    profiles: Array<{ id: string; name: string; avatarColor: string; avatarEmoji: string | null; userId: string | null; role: string; isMe: boolean }>
  }>('/api/auth/me'),

  signup: (data: { name: string; email: string; password: string; householdName?: string; inviteCode?: string }) =>
    http<{ ok: boolean; user: { id: string; email: string; name: string; avatarColor: string }; householdId: string | null; role: string }>(
      '/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    http<{ ok: boolean; user: { id: string; email: string; name: string; avatarColor: string }; householdId: string | null; role: string }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => http<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }),

  // Households
  createHousehold: (data: { name: string }) =>
    http<{ ok: boolean; household: { id: string; name: string; inviteCode: string } }>('/api/households', { method: 'POST', body: JSON.stringify(data) }),
  joinHousehold: (data: { inviteCode: string; name?: string }) =>
    http<{ ok: boolean; household: { id: string; name: string; inviteCode: string } }>('/api/households/join', { method: 'POST', body: JSON.stringify(data) }),
  switchHousehold: (data: { householdId: string }) =>
    http<{ ok: boolean; household: { id: string; name: string; inviteCode: string; ownerId: string }; role: string }>('/api/households/switch', { method: 'POST', body: JSON.stringify(data) }),
  regenerateInvite: (id: string) =>
    http<{ ok: boolean; inviteCode: string }>(`/api/households/${id}/invite`, { method: 'POST', body: JSON.stringify({}) }),
  getHouseholdSettings: (id: string) =>
    http<{ tierLabels: Record<string, string> | null; autoApprove: boolean; theme: string }>(`/api/households/${id}/settings`),
  updateHouseholdSettings: (id: string, data: { tierLabels?: Record<string, string> | null; autoApprove?: boolean; theme?: string }) =>
    http<{ ok: boolean; tierLabels: Record<string, string> | null; autoApprove: boolean; theme: string }>(`/api/households/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
  leaveHousehold: (householdId: string) =>
    http<{ ok: boolean; switchedTo: string | null }>(`/api/households/${householdId}/leave`, { method: 'POST', body: JSON.stringify({}) }),
  deleteHousehold: (householdId: string) =>
    http<{ ok: boolean; switchedTo: string | null }>(`/api/households/${householdId}/danger`, { method: 'DELETE', body: JSON.stringify({}) }),
  changeMemberRole: (householdId: string, userId: string, data: { role?: 'MEMBER' | 'MODERATOR'; transferOwnership?: boolean }) =>
    http<{ ok: boolean; role?: string; transferred?: boolean }>(`/api/households/${householdId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeMember: (householdId: string, userId: string) =>
    http<{ ok: boolean }>(`/api/households/${householdId}/members/${userId}`, { method: 'DELETE' }),

  // Profile
  updateProfile: (data: { name?: string; avatarColor?: string; avatarEmoji?: string; currentPassword?: string; newPassword?: string }) =>
    http<{ ok: boolean }>('/api/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: () => http<{ ok: boolean }>('/api/me/account', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),

  // Moderation
  moderationQueue: (status: 'open' | 'all' = 'open') =>
    http<{ flags: Array<any> }>(`/api/moderation/queue?status=${status}`).then((r) => r.flags),
  moderationAudit: (limit = 100, actionType?: string) => {
    const qs = new URLSearchParams()
    qs.set('limit', String(limit))
    if (actionType) qs.set('actionType', actionType)
    return http<{ actions: Array<any> }>(`/api/moderation/audit?${qs.toString()}`).then((r) => r.actions)
  },
  flagLog: (id: string, reason: string) =>
    http<{ ok: boolean; flag: { id: string } }>(`/api/moderation/logs/${id}/flag`, { method: 'POST', body: JSON.stringify({ reason }) }),
  approveLog: (id: string, reason?: string) =>
    http<{ ok: boolean; status: string }>(`/api/moderation/logs/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rejectLog: (id: string, reason: string) =>
    http<{ ok: boolean }>(`/api/moderation/logs/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resolveLog: (id: string, data: { newTier?: 1 | 3 | 5; reason?: string }) =>
    http<{ ok: boolean }>(`/api/moderation/logs/${id}/resolve`, { method: 'POST', body: JSON.stringify(data) }),
  restoreLog: (id: string) =>
    http<{ ok: boolean }>(`/api/moderation/logs/${id}/restore`, { method: 'POST', body: JSON.stringify({}) }),
}
