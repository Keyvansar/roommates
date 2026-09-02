'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { broadcastChange } from '@/lib/realtime'

export const modKeys = {
  queue: ['moderation', 'queue'] as const,
  audit: ['moderation', 'audit'] as const,
}

function invalidateAfterMod(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: modKeys.queue })
  void qc.invalidateQueries({ queryKey: qk.logs })
  void qc.invalidateQueries({ queryKey: [...qk.logs, 'deleted'] })
  void qc.invalidateQueries({ queryKey: qk.balance })
  void qc.invalidateQueries({ queryKey: qk.stats })
  void qc.invalidateQueries({ queryKey: ['stats', 'weekly'] })
  broadcastChange({ type: 'purchase-logs', action: 'update' })
}

/* --------------------------------- Queries -------------------------------- */

export function useModerationQueue() {
  return useQuery({
    queryKey: modKeys.queue,
    queryFn: () => api.moderationQueue('open'),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useModerationAudit(actionType?: string) {
  return useQuery({
    queryKey: [...modKeys.audit, actionType ?? ''],
    queryFn: () => api.moderationAudit(100, actionType),
  })
}

/* -------------------------------- Mutations ------------------------------- */

export function useFlagLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.flagLog(id, reason),
    onSuccess: () => {
      invalidateAfterMod(qc)
      toast.success('گزارش ثبت شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ثبت گزارش'),
  })
}

export function useApproveLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.approveLog(id, reason),
    onSuccess: () => {
      invalidateAfterMod(qc)
      toast.success('رکورد تأیید شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در تأیید'),
  })
}

export function useRejectLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectLog(id, reason),
    onSuccess: () => {
      invalidateAfterMod(qc)
      toast.success('رکورد رد شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در رد'),
  })
}

export function useResolveLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; newTier?: 1 | 3 | 5; reason?: string }) =>
      api.resolveLog(id, data),
    onSuccess: () => {
      invalidateAfterMod(qc)
      toast.success('گزارش حل شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در حل گزارش'),
  })
}

export function useRestoreLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.restoreLog(id),
    onSuccess: () => {
      invalidateAfterMod(qc)
      toast.success('رکورد بازیابی شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در بازیابی'),
  })
}

export function useChangeMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ householdId, userId, ...data }: {
      householdId: string
      userId: string
      role?: 'MEMBER' | 'MODERATOR'
      transferOwnership?: boolean
    }) => api.changeMemberRole(householdId, userId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      void qc.invalidateQueries({ queryKey: qk.profiles })
      broadcastChange({ type: 'profiles', action: 'update' })
      toast.success('نقش عضو به‌روز شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در تغییر نقش'),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ householdId, userId }: { householdId: string; userId: string }) =>
      api.removeMember(householdId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      void qc.invalidateQueries({ queryKey: qk.profiles })
      void qc.invalidateQueries({ queryKey: qk.balance })
      broadcastChange({ type: 'profiles', action: 'update' })
      toast.success('عضو حذف شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در حذف عضو'),
  })
}
