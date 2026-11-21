<script lang="ts">
  import { Button } from '$lib/components/ui/button'

  let { message, onRetry }: { message: string; onRetry: () => void } = $props()
</script>

<div class="flex flex-col items-center gap-3 rounded-card bg-card px-5 py-8 text-center" role="alert">
  <p class="text-sm text-muted-foreground">{message}</p>
  <Button variant="outline" onclick={onRetry}>Try again</Button>
</div>
