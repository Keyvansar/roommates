'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { broadcastChange } from '@/lib/realtime'
import { useUserStore } from '@/lib/store'
import type { CategoryDTO, ItemDTO, ItemStatus, PointTier, PurchaseLogDTO } from '@/lib/types'

const STATS_RANGE = ['all', '3m', '1m'] as const
type StatsRange = (typeof STATS_RANGE)[number]

function invalidateStats(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.stats })
  void qc.invalidateQueries({ queryKey: ['stats', 'weekly'] })
}

/* --------------------------------- Queries -------------------------------- */

export function useProfiles() {
  return useQuery({ queryKey: qk.profiles, queryFn: () => api.listProfiles() })
}

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: () => api.listCategories() })
}

export function useItems() {
  return useQuery({
    queryKey: qk.items,
    queryFn: () => api.listItems(),
    staleTime: 20_000,
    refetchInterval: 20_000,
  })
}

export function useLogs(limit = 200, includeDeleted = false) {
  return useQuery({
    queryKey: includeDeleted ? [...qk.logs, 'deleted'] : qk.logs,
    queryFn: () => api.listLogs(limit, includeDeleted),
  })
}

export function useBalance() {
  return useQuery({
    queryKey: qk.balance,
    queryFn: () => api.getBalance(),
    staleTime: 20_000,
    refetchInterval: 20_000,
  })
}

export function useStats(range: StatsRange = 'all') {
  return useQuery({
    queryKey: [...qk.stats, range],
    queryFn: () => api.getStats(range),
  })
}

export function useCategoryStats(categoryId: string | null | undefined, range: StatsRange = 'all') {
  return useQuery({
    queryKey: [...qk.stats, 'category', categoryId ?? '', range],
    queryFn: () => api.getCategoryStats(categoryId as string, range),
    enabled: !!categoryId,
  })
}

export function useBuyerStats(profileId: string | null | undefined, range: StatsRange = 'all') {
  return useQuery({
    queryKey: [...qk.stats, 'buyer', profileId ?? '', range],
    queryFn: () => api.getBuyerStats(profileId as string, range),
    enabled: !!profileId,
  })
}

export function useTierStats(tier: PointTier | null | undefined, range: StatsRange = 'all') {
  return useQuery({
    queryKey: [...qk.stats, 'tier', String(tier ?? ''), range],
    queryFn: () => api.getTierStats(tier as 1 | 3 | 5, range),
    enabled: !!tier,
  })
}

export function useWeeklyStats() {
  return useQuery({ queryKey: ['stats', 'weekly'], queryFn: () => api.getWeeklyStats() })
}

/* -------------------------------- Mutations ------------------------------- */

export function useToggleItemStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) =>
      api.updateItem(id, { status }),
    onSuccess: (item: ItemDTO) => {
      void qc.invalidateQueries({ queryKey: qk.items })
      invalidateStats(qc)
      broadcastChange({ type: 'items', action: 'update', ref: item.id })
      toast.success('وضعیت آیتم به‌روز شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در تغییر وضعیت'),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: ItemStatus; pointTier?: PointTier; title?: string }) =>
      api.updateItem(id, data),
    onSuccess: (item: ItemDTO) => {
      void qc.invalidateQueries({ queryKey: qk.items })
      invalidateStats(qc)
      broadcastChange({ type: 'items', action: 'update', ref: item.id })
      toast.success('آیتم به‌روز شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ویرایش آیتم'),
  })
}

export function useCheckout() {
  const qc = useQueryClient()
  const activeProfile = useUserStore((s) => s.activeProfile)
  return useMutation({
    mutationFn: (data: { itemId?: string; pointTier?: PointTier; itemTitle?: string; buyerId?: string }) =>
      api.checkout({
        itemId: data.itemId,
        buyerId: data.buyerId ?? activeProfile?.id ?? '',
        pointTier: data.pointTier,
        itemTitle: data.itemTitle,
      }),
    onSuccess: (log: PurchaseLogDTO) => {
      void qc.invalidateQueries({ queryKey: qk.items })
      void qc.invalidateQueries({ queryKey: qk.balance })
      invalidateStats(qc)
      broadcastChange({ type: 'purchase-logs', action: 'checkout', ref: log.id, by: log.buyerId })
      toast.success('خرید ثبت شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ثبت خرید'),
  })
}

export function useUpdateLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; buyerId?: string; pointTier?: PointTier; itemTitle?: string }) =>
      api.updateLog(id, data),
    onSuccess: (log: PurchaseLogDTO) => {
      void qc.invalidateQueries({ queryKey: qk.logs })
      void qc.invalidateQueries({ queryKey: qk.balance })
      invalidateStats(qc)
      broadcastChange({ type: 'purchase-logs', action: 'update', ref: log.id })
      toast.success('رکورد به‌روز شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ویرایش رکورد'),
  })
}

export function useDeleteLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: string | { id: string; hard?: boolean; reason?: string }) => {
      if (typeof input === 'string') return api.deleteLog(input, { hard: false })
      return api.deleteLog(input.id, { hard: input.hard, reason: input.reason })
    },
    onSuccess: (_data, input) => {
      const id = typeof input === 'string' ? input : input.id
      const hard = typeof input === 'string' ? false : !!input.hard
      void qc.invalidateQueries({ queryKey: qk.logs })
      void qc.invalidateQueries({ queryKey: [...qk.logs, 'deleted'] })
      void qc.invalidateQueries({ queryKey: qk.balance })
      invalidateStats(qc)
      broadcastChange({ type: 'purchase-logs', action: hard ? 'delete' : 'update', ref: id })
      toast.success(hard ? 'رکورد برای همیشه حذف شد' : 'رکورد حذف شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در حذف رکورد'),
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; categoryId: string; pointTier: PointTier; status?: ItemStatus }) =>
      api.createItem(data),
    onSuccess: (item: ItemDTO) => {
      void qc.invalidateQueries({ queryKey: qk.items })
      invalidateStats(qc)
      broadcastChange({ type: 'items', action: 'create', ref: item.id })
      toast.success('آیتم ساخته شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ساخت آیتم'),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; icon?: string; sortOrder?: number }) => api.createCategory(data),
    onSuccess: (cat: CategoryDTO) => {
      void qc.invalidateQueries({ queryKey: qk.categories })
      broadcastChange({ type: 'items', action: 'update', ref: cat.id })
      toast.success('دسته ساخته شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ساخت دسته'),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; icon?: string; sortOrder?: number }) =>
      api.updateCategory(id, data),
    onSuccess: (cat: CategoryDTO) => {
      void qc.invalidateQueries({ queryKey: qk.categories })
      void qc.invalidateQueries({ queryKey: qk.items })
      broadcastChange({ type: 'items', action: 'update', ref: cat.id })
      toast.success('دسته به‌روز شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ویرایش دسته'),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, moveTo }: { id: string; moveTo?: string }) => api.deleteCategory(id, moveTo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.categories })
      void qc.invalidateQueries({ queryKey: qk.items })
      invalidateStats(qc)
      broadcastChange({ type: 'items', action: 'delete' })
      toast.success('دسته حذف شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در حذف دسته'),
  })
}

export function useReseed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.reseed(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.profiles })
      void qc.invalidateQueries({ queryKey: qk.categories })
      void qc.invalidateQueries({ queryKey: qk.items })
      void qc.invalidateQueries({ queryKey: qk.logs })
      void qc.invalidateQueries({ queryKey: [...qk.logs, 'deleted'] })
      void qc.invalidateQueries({ queryKey: qk.balance })
      invalidateStats(qc)
      broadcastChange({ type: 'items', action: 'bulk' })
      broadcastChange({ type: 'purchase-logs', action: 'bulk' })
      broadcastChange({ type: 'balance', action: 'update' })
      broadcastChange({ type: 'profiles', action: 'bulk' })
      toast.success('داده‌ها بازنشانی شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در بازنشانی داده'),
  })
}
