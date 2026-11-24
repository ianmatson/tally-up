import type { EarnedTitle, TitleId } from './achievements'

export type User = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

export type Member = {
  id: string
  name: string
  avatarUrl: string | null
  selectedTitle?: TitleId | null
  joinedAt: number
}

export type GroupSummary = {
  id: string
  name: string
  isOwner: boolean
  memberCount: number
}

export type GoalSummary = {
  id: string
  name: string
  startDate: string
  endDate: string
  archived: boolean
}

export type GroupDetail = {
  id: string
  name: string
  timezone: string
  ownerId: string
  isOwner: boolean
  inviteCode: string | null
  members: Member[]
  goals: GoalSummary[]
  achievementsEnabled?: boolean
  earnedTitles?: EarnedTitle[]
}

export const COMPONENT_PERIODS = ['day', 'week', 'month'] as const
export type ComponentPeriod = (typeof COMPONENT_PERIODS)[number]

export type Component = {
  id: string
  name: string
  unit: string
  target: number
  weight: number
  period: ComponentPeriod
}

export type Entry = {
  id: string
  componentId: string
  userId: string
  amount: number
  date: string
  note: string | null
  occurredAt: number
  createdAt: number
  reactions: Reaction[]
  comments: Comment[]
}

export type Reaction = {
  emoji: string
  userIds: string[]
}

export type Comment = {
  id: string
  userId: string
  body: string
  createdAt: number
}

export type NotificationSettings = {
  reminders: boolean
  reminderMinute: number
  reminderDays: number
  contributions: boolean
  comments: boolean
  timezone: string
}

export type NotificationConfig = {
  settings: NotificationSettings
  vapidPublicKey: string
}

export type PushSubscriptionInput = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type GoalDetail = GoalSummary & {
  components: Component[]
  entries: Entry[]
}

export type ComponentInput = {
  id?: string
  name: string
  unit: string
  target: number
  weight: number
  period: ComponentPeriod
}

export type GoalInput = {
  name: string
  startDate: string
  endDate: string
  components: ComponentInput[]
  removedComponentIds: string[]
}

export type EntryInput = {
  componentId: string
  amount: number
  occurredAt: number
  note: string | null
}

export type InvitePreview = {
  groupId: string
  groupName: string
  memberCount: number
  alreadyMember: boolean
}
