<script lang="ts">
  import type { User } from '$shared/api'
  import BrandMark from '$lib/components/BrandMark.svelte'
  import ProfileForm from '$lib/components/ProfileForm.svelte'
  import { signOut } from '$lib/session'

  let { user }: { user: User } = $props()
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
  <section class="rise-in rounded-card bg-card p-6 sm:p-7">
    <BrandMark size="lg" />
    <h1 class="mt-5 text-2xl font-semibold tracking-tight">Set up your profile</h1>
    <p class="mt-1 mb-6 text-sm text-muted-foreground">Your groups see this name and photo. You can change them later in Settings.</p>
    <ProfileForm {user} submitLabel="Continue" />
  </section>
  <p class="rise-in mt-4 text-center text-sm text-muted-foreground [animation-delay:60ms]">
    Signed in as <span class="break-all">{user.email}</span><br />
    Not you? <button type="button" class="font-medium text-foreground underline-offset-2 hover:underline" onclick={signOut}>Sign out</button>
  </p>
</main>
