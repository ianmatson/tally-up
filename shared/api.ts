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
}

export type Component = {
  id: string
  name: string
  unit: string
  target: number
  weight: number
}

export type Entry = {
  id: string
  componentId: string
  userId: string
  amount: number
  date: string
  note: string | null
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
  date: string
  note: string | null
}

export type InvitePreview = {
  groupId: string
  groupName: string
  memberCount: number
  alreadyMember: boolean
}
