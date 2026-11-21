<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { ModeWatcher } from 'mode-watcher'
  import { Toaster } from '$lib/components/ui/sonner'
  import { queryClient } from '$lib/queries'
  import Routes from './Routes.svelte'
</script>

<ModeWatcher themeColors={{ light: '#ecebe7', dark: '#121212' }} />
<Toaster position="top-center" richColors />
<QueryClientProvider client={queryClient}>
  <Routes />
</QueryClientProvider>
