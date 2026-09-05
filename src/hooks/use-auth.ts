'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { qk } from '@/lib/query-keys'
import { broadcastChange } from '@/lib/realtime'
import { useUserStore } from '@/lib/store'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

export const householdSettingsKeys = {
  detail: (id: string) => ['household-settings', id] as const,
}

/* --------------------------------- Queries -------------------------------- */

export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: () => api.me() })
}

export function useHouseholdSettings(householdId: string | null | undefined) {
  return useQuery({
    queryKey: householdSettingsKeys.detail(householdId ?? ''),
    queryFn: () => api.getHouseholdSettings(householdId as string),
    enabled: !!householdId,
  })
}

/* -------------------------------- Mutations ------------------------------- */

export function useSignup() {
  const qc = useQueryClient()
  const setSession = useUserStore((s) => s.setSession)
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; householdName?: string; inviteCode?: string }) =>
      api.signup(data),
    onSuccess: (res) => {
      setSession({
        user: { id: res.user.id, email: res.user.email, name: res.user.name, avatarColor: res.user.avatarColor, avatarEmoji: null },
        household: null,
        role: res.role,
      })
      void qc.invalidateQueries({ queryKey: authKeys.me })
      void qc.invalidateQueries({ queryKey: qk.profiles })
      toast.success('حساب ساخته شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ثبت‌نام'),
  })
}

export function useLogin() {
  const qc = useQueryClient()
  const setSession = useUserStore((s) => s.setSession)
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => api.login(data),
    onSuccess: (res) => {
      setSession({
        user: { id: res.user.id, email: res.user.email, name: res.user.name, avatarColor: res.user.avatarColor, avatarEmoji: null },
        household: null,
        role: res.role,
      })
      void qc.invalidateQueries({ queryKey: authKeys.me })
      void qc.invalidateQueries({ queryKey: qk.profiles })
      toast.success('ورود موفق بود')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ورود'),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const clearSession = useUserStore((s) => s.clearSession)
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      clearSession()
      void qc.clear()
      toast.success('خارج شدید')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در خروج'),
  })
}

export function useCreateHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => api.createHousehold(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      toast.success('خانه ساخته شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ساخت خانه'),
  })
}

export function useJoinHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { inviteCode: string; name?: string }) => api.joinHousehold(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      toast.success('به خانه پیوستید')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در پیوستن'),
  })
}

export function useSwitchHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { householdId: string }) => api.switchHousehold(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      void qc.invalidateQueries({ queryKey: qk.items })
      void qc.invalidateQueries({ queryKey: qk.logs })
      void qc.invalidateQueries({ queryKey: qk.balance })
      broadcastChange({ type: 'items', action: 'update' })
      toast.success('خانه تغییر کرد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در تغییر خانه'),
  })
}

export function useRegenerateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.regenerateInvite(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      toast.success('کد دعوت جدید ساخته شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ساخت کد'),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; avatarColor?: string; avatarEmoji?: string; currentPassword?: string; newPassword?: string }) =>
      api.updateProfile(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      void qc.invalidateQueries({ queryKey: qk.profiles })
      broadcastChange({ type: 'profiles', action: 'update' })
      toast.success('پروفایل به‌روز شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ویرایش پروفایل'),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.updateProfile(data),
    onSuccess: () => toast.success('رمز عبور تغییر کرد'),
    onError: (e: Error) => toast.error(e.message || 'خطا در تغییر رمز'),
  })
}

export function useLeaveHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (householdId: string) => api.leaveHousehold(householdId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      void qc.invalidateQueries({ queryKey: qk.items })
      void qc.invalidateQueries({ queryKey: qk.logs })
      void qc.invalidateQueries({ queryKey: qk.balance })
      broadcastChange({ type: 'profiles', action: 'update' })
      toast.success('از خانه خارج شدید')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در خروج'),
  })
}

export function useDeleteHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (householdId: string) => api.deleteHousehold(householdId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.me })
      void qc.invalidateQueries({ queryKey: qk.items })
      void qc.invalidateQueries({ queryKey: qk.logs })
      void qc.invalidateQueries({ queryKey: qk.balance })
      broadcastChange({ type: 'profiles', action: 'update' })
      toast.success('خانه حذف شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در حذف خانه'),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  const clearSession = useUserStore((s) => s.clearSession)
  return useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => {
      clearSession()
      void qc.clear()
      toast.success('حساب شما حذف شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در حذف حساب'),
  })
}

export function useUpdateHouseholdSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; tierLabels?: Record<string, string> | null; autoApprove?: boolean; theme?: string }) =>
      api.updateHouseholdSettings(id, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: householdSettingsKeys.detail(vars.id) })
      toast.success('تنظیمات ذخیره شد')
    },
    onError: (e: Error) => toast.error(e.message || 'خطا در ذخیره تنظیمات'),
  })
}
