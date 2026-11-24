<script lang="ts">
  import { describeActivity } from '$shared/units'
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
  import type { Component, Entry, Member } from '$shared/api'
  import { activityLines, formatDateTime, formatTime, formatWhen, memberLabel } from '$lib/format'
  import { cn } from '$lib/utils'
  import EntryAmounts from './EntryAmounts.svelte'
  import ReactionBar from './ReactionBar.svelte'
  import UserAvatar from './UserAvatar.svelte'

  const INLINE_COMMENTS = 2

  let { entry, componentsById, goalId, userId, membersById, now, showComments = false, compact = false, timeZone, onOpen }: {
    entry: Entry
    componentsById: Map<string, Component>
    goalId: string
    userId: string
    membersById: Map<string, Member>
    now: Date
    showComments?: boolean
    compact?: boolean
    timeZone?: string
    onOpen: (focusComposer: boolean) => void
  } = $props()

  const member = $derived(membersById.get(entry.userId))
  const isMine = $derived(entry.userId === userId)
  const authorName = (id: string) => memberLabel(membersById, id, userId)
  const shownComments = $derived(entry.comments.slice(-INLINE_COMMENTS))

  const lines = $derived(activityLines(entry.amounts, componentsById))
</script>

<article class="flex gap-3">
  <UserAvatar name={member?.name ?? '?'} avatarUrl={member?.avatarUrl ?? null} size="sm" tone={isMine ? 'highlight' : 'muted'} />
  <div class="min-w-0 flex-1">
    <button
      type="button"
      class="-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-left transition-colors hover:bg-accent"
      aria-label="Open {isMine ? 'your' : `${authorName(entry.userId)}'s`} {describeActivity(lines)}, {formatDateTime(entry.occurredAt)}"
      onclick={() => onOpen(false)}
    >
      <span class="flex items-baseline justify-between gap-3">
        <span class="min-w-0 text-sm">
          <span class="font-medium">{authorName(entry.userId)}</span>
          <span class="text-muted-foreground">logged</span>
          <EntryAmounts {lines} />
        </span>
        <time class="shrink-0 text-xs text-muted-foreground" datetime={new Date(entry.occurredAt).toISOString()}>
          {timeZone ? formatTime(entry.occurredAt, timeZone) : formatWhen(entry.occurredAt, now)}
        </time>
      </span>
      {#if entry.note}
        <span class="mt-1.5 block w-fit max-w-full rounded-[14px] rounded-tl-[4px] bg-secondary px-3 py-1.5 text-sm break-words">{entry.note}</span>
      {/if}
      {#if entry.photoUrl}
        <img
          src={entry.photoUrl}
          alt=""
          loading="lazy"
          class={cn('mt-2 block aspect-[4/3] w-full rounded-2xl bg-secondary object-cover', compact ? 'max-w-40' : 'max-w-72')}
        />
      {/if}
    </button>

    {#if !compact || entry.reactions.length > 0 || entry.comments.length > 0}
      <div class="mt-2 flex items-center justify-between gap-2">
        <ReactionBar {entry} {goalId} {userId} {membersById} />
        <button
          type="button"
          class="flex h-7 shrink-0 items-center gap-1 self-start rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={entry.comments.length ? `${entry.comments.length} comments` : 'Add a comment'}
          onclick={() => onOpen(true)}
        >
          <MessageCircleIcon class="size-4" />
          {#if entry.comments.length}<span class="tabular">{entry.comments.length}</span>{/if}
        </button>
      </div>
    {/if}

    {#if showComments && entry.comments.length > 0}
      <div class="mt-2.5 flex flex-col gap-2 border-l-2 border-border pl-3">
        {#if entry.comments.length > shownComments.length}
          <button type="button" class="w-fit text-xs font-medium text-muted-foreground hover:text-foreground" onclick={() => onOpen(false)}>
            View all {entry.comments.length} comments
          </button>
        {/if}
        {#each shownComments as comment (comment.id)}
          <p class="text-sm break-words">
            <span class="font-semibold">{authorName(comment.userId)}</span>
            <span class="text-foreground/90">{comment.body}</span>
          </p>
        {/each}
      </div>
    {/if}
  </div>
</article>
