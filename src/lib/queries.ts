import { MutationCache, QueryCache, QueryClient, queryOptions } from '@tanstack/svelte-query'
import { toast } from 'svelte-sonner'
import type { GoalDetail, GroupDetail, GroupSummary, InvitePreview, NotificationConfig, User } from '$shared/api'
import { api, ApiError } from './api'

const MAX_RETRIES = 2

function signOutOnExpiredSession(error: Error) {
  if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(meQuery().queryKey, null)
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: signOutOnExpiredSession }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      signOutOnExpiredSession(error)
      if (!mutation.meta?.inlineError) toast.error(error.message)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < MAX_RETRIES,
    },
  },
})

export const meQuery = () =>
  queryOptions({
    queryKey: ['me'],
    queryFn: () => api<{ user: User | null }>('/me').then((r) => r.user),
    staleTime: Infinity,
  })

export const groupsQuery = () => queryOptions({ queryKey: ['groups'], queryFn: () => api<GroupSummary[]>('/groups') })

export const groupQuery = (groupId: string) =>
  queryOptions({ refetchInterval: 30_000, queryKey: ['group', groupId], queryFn: () => api<GroupDetail>(`/groups/${groupId}`) })

export const allGoalsKey = ['goal'] as const

export const goalQuery = (goalId: string) =>
  queryOptions({ refetchInterval: 30_000, queryKey: ['goal', goalId], queryFn: () => api<GoalDetail>(`/goals/${goalId}`) })

export const inviteQuery = (code: string) =>
  queryOptions({ queryKey: ['invite', code], queryFn: () => api<InvitePreview>(`/invites/${code}`) })

export const notificationsQuery = () =>
  queryOptions({ queryKey: ['notifications'], queryFn: () => api<NotificationConfig>('/notifications') })
