<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SmilePlusIcon from '@lucide/svelte/icons/smile-plus'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import type { Entry, GoalDetail, Member } from '$shared/api'
  import { normalizeReaction, QUICK_REACTIONS } from '$shared/social'
  import { api } from '$lib/api'
  import { memberLabel } from '$lib/format'
  import { goalQuery } from '$lib/queries'
  import { withReaction } from '$lib/social'
  import * as Popover from '$lib/components/ui/popover'
  import EmojiPicker from './EmojiPicker.svelte'
  import { cn } from '$lib/utils'

  let { entry, goalId, userId, membersById }: {
    entry: Entry
    goalId: string
    userId: string
    membersById: Map<string, Member>
  } = $props()

  const queryClient = useQueryClient()
  const HOLD_MS = 450
  let pickerOpen = $state(false)
  let showAll = $state(false)
  let heldEmoji = $state<string | null>(null)
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let heldClick = false

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

  function pick(emoji: string) {
    if (emoji) react(normalizeReaction(emoji))
    pickerOpen = false
  }
  const nameList = (ids: string[]) => ids.map((id) => memberLabel(membersById, id, userId))
  const names = (ids: string[]) => nameList(ids).join(', ')

  function startHold(emoji: string) {
    clearTimeout(holdTimer)
    holdTimer = setTimeout(() => {
      heldEmoji = emoji
      heldClick = true
    }, HOLD_MS)
  }

  const endHold = () => clearTimeout(holdTimer)

  function tapReaction(event: MouseEvent, emoji: string) {
    event.preventDefault()
    if (heldClick) heldClick = false
    else react(emoji)
  }
</script>

<div class="flex flex-wrap items-center gap-1.5">
  {#each entry.reactions as reaction (reaction.emoji)}
    {@const pressed = reaction.userIds.includes(userId)}
    <Popover.Root bind:open={() => heldEmoji === reaction.emoji, (open) => !open && (heldEmoji = null)}>
      <Popover.Trigger
        class={cn(
          'flex h-7 items-center gap-1 rounded-full px-2 text-sm transition-[background-color,transform] duration-150 select-none [-webkit-touch-callout:none] active:scale-95',
          pressed ? 'bg-highlight text-highlight-foreground' : 'bg-secondary hover:bg-accent',
        )}
        aria-pressed={pressed}
        aria-label="{reaction.emoji} from {names(reaction.userIds)}"
        title={names(reaction.userIds)}
        onpointerdown={() => startHold(reaction.emoji)}
        onpointerup={endHold}
        onpointerleave={endHold}
        onpointercancel={endHold}
        oncontextmenu={(event) => event.preventDefault()}
        onclick={(event) => tapReaction(event, reaction.emoji)}
      >
        <span class="text-[0.95rem] leading-none">{reaction.emoji}</span>
        <span class="tabular text-xs font-semibold">{reaction.userIds.length}</span>
      </Popover.Trigger>
      <Popover.Content align="start" side="top" collisionPadding={12} class="w-auto max-w-64 gap-1 rounded-2xl px-3.5 py-2.5" onOpenAutoFocus={(event) => event.preventDefault()}>
        <p class="text-xs text-muted-foreground">Reacted with {reaction.emoji}</p>
        <ul class="flex flex-col gap-0.5">
          {#each nameList(reaction.userIds) as name, i (i)}<li class="font-medium">{name}</li>{/each}
        </ul>
      </Popover.Content>
    </Popover.Root>
  {/each}
  <Popover.Root bind:open={pickerOpen} onOpenChange={(open) => open && (showAll = false)}>
    <Popover.Trigger
      class="grid h-7 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-secondary"
      aria-label="Add a reaction"
    >
      <SmilePlusIcon class="size-4" />
    </Popover.Trigger>
    <Popover.Content align="start" collisionPadding={12} class={cn('w-auto rounded-full p-1', showAll && 'panel-expand overflow-hidden rounded-2xl p-0')}>
      {#if showAll}
        <EmojiPicker onPick={pick} />
      {:else}
        <div class="flex gap-0.5">
          {#each QUICK_REACTIONS as emoji (emoji)}
            <button
              type="button"
              class={cn(
                'grid size-8 place-items-center rounded-full text-lg transition-transform duration-150 ease-spring hover:scale-110 hover:bg-accent active:scale-95',
                mine(emoji) && 'bg-highlight',
              )}
              aria-label={mine(emoji) ? `Remove ${emoji}` : `React with ${emoji}`}
              onclick={() => pick(emoji)}
            >
              {emoji}
            </button>
          {/each}
          <button
            type="button"
            class="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="More emoji"
            onclick={() => (showAll = true)}
          >
            <PlusIcon class="size-4" />
          </button>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
