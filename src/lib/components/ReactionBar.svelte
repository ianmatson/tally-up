<script lang="ts">
  import SmilePlusIcon from '@lucide/svelte/icons/smile-plus'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import type { Entry, GoalDetail, Member } from '$shared/api'
  import { REACTIONS } from '$shared/social'
  import { api } from '$lib/api'
  import { memberLabel } from '$lib/format'
  import { goalQuery } from '$lib/queries'
  import { withReaction } from '$lib/social'
  import * as Popover from '$lib/components/ui/popover'
  import { cn } from '$lib/utils'

  let { entry, goalId, userId, membersById }: {
    entry: Entry
    goalId: string
    userId: string
    membersById: Map<string, Member>
  } = $props()

  const queryClient = useQueryClient()
  let pickerOpen = $state(false)

  const toggle = createMutation(() => ({
    mutationFn: ({ emoji, on }: { emoji: string; on: boolean }) =>
      api(`/entries/${entry.id}/reactions/${encodeURIComponent(emoji)}`, { method: on ? 'PUT' : 'DELETE' }),
    onMutate: async ({ emoji, on }) => {
      const key = goalQuery(goalId).queryKey
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData(key, (goal: GoalDetail | undefined) =>
        goal && {
          ...goal,
          entries: goal.entries.map((e) => (e.id === entry.id ? { ...e, reactions: withReaction(e.reactions, emoji, userId, on) } : e)),
        },
      )
    },
    onError: () => queryClient.invalidateQueries({ queryKey: goalQuery(goalId).queryKey }),
  }))

  const mine = (emoji: string) => entry.reactions.some((r) => r.emoji === emoji && r.userIds.includes(userId))
  const react = (emoji: string) => toggle.mutate({ emoji, on: !mine(emoji) })
  const names = (ids: string[]) => ids.map((id) => memberLabel(membersById, id, userId)).join(', ')
</script>

<div class="flex flex-wrap items-center gap-1.5">
  {#each entry.reactions as reaction (reaction.emoji)}
    {@const pressed = reaction.userIds.includes(userId)}
    <button
      type="button"
      class={cn(
        'flex h-7 items-center gap-1 rounded-full px-2 text-sm transition-[background-color,transform] duration-150 active:scale-95',
        pressed ? 'bg-highlight text-highlight-foreground' : 'bg-secondary hover:bg-accent',
      )}
      aria-pressed={pressed}
      aria-label="{reaction.emoji} from {names(reaction.userIds)}"
      title={names(reaction.userIds)}
      onclick={() => react(reaction.emoji)}
    >
      <span class="text-[0.95rem] leading-none">{reaction.emoji}</span>
      <span class="tabular text-xs font-semibold">{reaction.userIds.length}</span>
    </button>
  {/each}
  <Popover.Root bind:open={pickerOpen}>
    <Popover.Trigger
      class="grid h-7 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-secondary"
      aria-label="Add a reaction"
    >
      <SmilePlusIcon class="size-4" />
    </Popover.Trigger>
    <Popover.Content align="start" collisionPadding={12} class="w-auto flex-row gap-0.5 rounded-full p-1">
      {#each REACTIONS as emoji (emoji)}
        <button
          type="button"
          class={cn(
            'grid size-8 place-items-center rounded-full text-lg transition-transform duration-150 ease-spring hover:scale-110 hover:bg-accent active:scale-95',
            mine(emoji) && 'bg-highlight',
          )}
          aria-label={mine(emoji) ? `Remove ${emoji}` : `React with ${emoji}`}
          onclick={() => {
            react(emoji)
            pickerOpen = false
          }}
        >
          {emoji}
        </button>
      {/each}
    </Popover.Content>
  </Popover.Root>
</div>
