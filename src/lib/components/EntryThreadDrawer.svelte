<script lang="ts">
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { tick } from 'svelte'
  import type { Comment, Entry, GoalDetail, GroupDetail, User } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import { activityLines, formatDateTime, formatWhen, memberLabel } from '$lib/format'
  import { describeActivity } from '$shared/units'
  import { goalQuery } from '$lib/queries'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import DrawerCloseButton from './DrawerCloseButton.svelte'
  import ReactionBar from './ReactionBar.svelte'
  import UserAvatar from './UserAvatar.svelte'

  let { open = $bindable(false), entry, goal, group, user, now, focusComposer, onEdit }: {
    open: boolean
    entry: Entry | null
    goal: GoalDetail
    group: GroupDetail
    user: User
    now: Date
    focusComposer: boolean
    onEdit: (entry: Entry) => void
  } = $props()

  const queryClient = useQueryClient()
  const membersById = $derived(new Map(group.members.map((m) => [m.id, m])))
  const componentsById = $derived(new Map(goal.components.map((c) => [c.id, c])))
  const canEdit = $derived(!!entry && !goal.archived && (entry.userId === user.id || group.isAdmin))

  let draft = $state('')
  let commentToDelete = $state<{ entryId: string; commentId: string } | null>(null)
  let composer = $state<HTMLTextAreaElement | null>(null)
  let scroller = $state<HTMLDivElement | null>(null)

  $effect(() => {
    if (open && focusComposer) requestAnimationFrame(() => composer?.focus())
  })

  let draftEntryId = $state<string | null>(null)
  $effect.pre(() => {
    if (entry && entry.id !== draftEntryId) {
      draftEntryId = entry.id
      draft = ''
    }
  })

  function updateComments(entryId: string, change: (comments: Comment[]) => Comment[]) {
    queryClient.setQueryData(goalQuery(goal.id).queryKey, (data: GoalDetail | undefined) =>
      data && { ...data, entries: data.entries.map((e) => (e.id === entryId ? { ...e, comments: change(e.comments) } : e)) },
    )
  }

  const post = createMutation(() => ({
    mutationFn: ({ entryId, body }: { entryId: string; body: string }) =>
      api<Comment>(`/entries/${entryId}/comments`, { method: 'POST', body: { body } }),
    onSuccess: (comment, { entryId, body }) => {
      updateComments(entryId, (comments) => [...comments, comment])
      if (draft.trim() === body) draft = ''
      tick().then(() => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' }))
    },
  }))

  const remove = createMutation(() => ({
    mutationFn: ({ commentId }: { entryId: string; commentId: string }) => api(`/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: (_result, { entryId, commentId }) => updateComments(entryId, (comments) => comments.filter((c) => c.id !== commentId)),
  }))

  const authorName = (id: string) => memberLabel(membersById, id, user.id)

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (entry && draft.trim() && !post.isPending) post.mutate({ entryId: entry.id, body: draft.trim() })
  }

  function onComposerKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    ;(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit()
  }
</script>

<Drawer.Root bind:open>
  <Drawer.Content>
    {#if entry}
      {@const owner = membersById.get(entry.userId)}
      <div class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <Drawer.Header class="relative px-4 pt-3 pb-3 text-left">
          <div class="flex items-center gap-3 pr-10">
            <UserAvatar name={owner?.name ?? '?'} avatarUrl={owner?.avatarUrl ?? null} tone={entry.userId === user.id ? 'highlight' : 'muted'} />
            <div class="min-w-0">
              <Drawer.Title class="text-base font-semibold tracking-tight">
                {authorName(entry.userId)} logged {describeActivity(activityLines(entry.amounts, componentsById))}
              </Drawer.Title>
              <Drawer.Description>{formatDateTime(entry.occurredAt)}</Drawer.Description>
            </div>
          </div>
          <DrawerCloseButton />
        </Drawer.Header>

        <div bind:this={scroller} class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
          {#if entry.note}
            <p class="w-fit max-w-full rounded-[16px] rounded-tl-[4px] bg-secondary px-3.5 py-2 break-words">{entry.note}</p>
          {/if}
          {#if entry.photoUrl}
            <img src={entry.photoUrl} alt="Attached to this entry" class="max-h-[50vh] max-w-full self-start rounded-2xl" />
          {/if}
          <div class="flex items-center justify-between gap-2">
            <ReactionBar {entry} goalId={goal.id} userId={user.id} {membersById} />
            {#if canEdit}
              <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={() => onEdit(entry)}>
                <PencilIcon /> Edit
              </Button>
            {/if}
          </div>

          <section aria-label="Comments" class="flex flex-col gap-3 border-t pt-4">
            {#if entry.comments.length === 0}
              <p class="text-sm text-muted-foreground">No comments yet. Say something nice.</p>
            {/if}
            {#each entry.comments as comment (comment.id)}
              {@const author = membersById.get(comment.userId)}
              <div class="group flex gap-2.5">
                <UserAvatar name={author?.name ?? '?'} avatarUrl={author?.avatarUrl ?? null} size="sm" tone={comment.userId === user.id ? 'highlight' : 'muted'} />
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2 text-xs">
                    <span class="font-medium">{authorName(comment.userId)}</span>
                    <span class="text-muted-foreground">{formatWhen(comment.createdAt, now)}</span>
                  </div>
                  <p class="text-sm break-words whitespace-pre-line">{comment.body}</p>
                </div>
                {#if comment.userId === user.id || group.isAdmin}
                  <button
                    type="button"
                    class="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-destructive"
                    aria-label="Delete comment"
                    disabled={remove.isPending}
                    onclick={() => (commentToDelete = { entryId: entry.id, commentId: comment.id })}
                  >
                    <Trash2Icon class="size-3.5" />
                  </button>
                {/if}
              </div>
            {/each}
          </section>
        </div>

        <form class="flex items-end gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onsubmit={submit}>
          <textarea
            bind:this={composer}
            bind:value={draft}
            rows="1"
            maxlength={LIMITS.comment}
            placeholder="Add a comment"
            aria-label="Add a comment"
            class="field-sizing-content max-h-32 min-h-10 flex-1 resize-none rounded-[20px] bg-secondary px-4 py-2 outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            onkeydown={onComposerKeydown}
          ></textarea>
          <Button type="submit" size="icon" class="size-10 shrink-0 rounded-full" aria-label="Send comment" disabled={!draft.trim() || post.isPending}>
            <ArrowUpIcon class="size-5" />
          </Button>
        </form>
      </div>
    {/if}
  </Drawer.Content>
</Drawer.Root>

<ConfirmDialog
  bind:open={() => commentToDelete !== null, (open) => !open && (commentToDelete = null)}
  title="Delete this comment?"
  description="Everyone in the group stops seeing it. You cannot undo this."
  confirmLabel="Delete comment"
  onConfirm={() => commentToDelete && remove.mutate(commentToDelete)}
/>
