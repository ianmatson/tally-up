<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { ModeWatcher } from 'mode-watcher'
  import { Toaster } from '$lib/components/ui/sonner'
  import { queryClient } from '$lib/queries'
  import { HOLIDAY_FLAIR } from '$lib/holiday/flag'
  import Snowfall from '$lib/holiday/Snowfall.svelte'
  import Routes from './Routes.svelte'
</script>

<ModeWatcher themeColors={{ light: '#ecebe7', dark: '#121212' }} />
<Toaster position="top-center" richColors />
{#if HOLIDAY_FLAIR}<Snowfall />{/if}
<QueryClientProvider client={queryClient}>
  <Routes />
</QueryClientProvider>
