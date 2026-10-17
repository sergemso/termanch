<script lang="ts">
  import type { Snippet } from 'svelte';
  import AgentBadge from './AgentBadge.svelte';
  import type { FleetState } from './states';
  import { cn } from '../ui/utils';
  /** The frame of a decision (decision 0104): who asks, how long it has waited, the question with its context,
   *  then the options. The options and the free-text field are children. */
  let { agent, command, session, waited, context, question, state = 'needs-you', children, class: className = '' }:
    { agent?: string; command?: string; session: string; waited?: string; context?: string; question: string; state?: FleetState; children: Snippet; class?: string } = $props();
</script>

<section class={cn('flex flex-col gap-3 rounded-[20px] border border-line bg-panel p-4', className)} aria-label="Decision">
  <header class="flex items-center gap-3">
    <AgentBadge {agent} {command} {state} />
    <div class="flex min-w-0 flex-1 flex-col"><b class="text-base font-semibold">{session}</b>{#if waited}<small class="text-xs font-semibold text-warn">Waiting {waited}</small>{/if}</div>
  </header>
  {#if context}<p class="text-base text-soft">{context}</p>{/if}
  <h2 class="text-title leading-tight font-bold tracking-tight">{question}</h2>
  {@render children()}
</section>
