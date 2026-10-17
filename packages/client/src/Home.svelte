<script lang="ts">
  import { onMount } from 'svelte';
  import { DecisionCard, EmptyState, FleetTile, OptionButton, QueueItem } from './lib/ds';
  import type { FleetState } from './lib/ds/states';
  import type { AgentMap, SessionAgent } from './lib/agents';
  import type { HubServer, HubSession } from './lib/hub';
  import { ageText } from './lib/cards';
  import { continueTarget, fleetCounts, heroChoices, queueOf, rowOf, Settle, splitQueue, type HomeQueue, type Row } from './lib/home';

  /** Home (decision 0100): the oldest waiting decision, the rest of the queue, the four fleet counts and Continue. */
  let { sessions, agents, servers, now, lastKey, onopen, onanswer, onservers, onnew }: {
    sessions: HubSession[]; agents: AgentMap; servers: HubServer[]; now: number; lastKey: string | null;
    onopen: (key: string) => void;
    onanswer: (key: string, choice: number, prompt: NonNullable<SessionAgent['prompt']>) => void;
    onservers: () => void; onnew: (serverId?: string) => void;
  } = $props();

  const FILTERS = ['needs-you', 'working', 'failed', 'finished'] as const;
  let filter = $state<FleetState | null>(null);
  // The queue moves only when no touch is down and 2 s after a scroll (ui-never-moves-under-the-finger); a beat re-reads it afterwards.
  const settle = new Settle<HomeQueue & { choices: string[] }>();
  let beat = $state(0);
  onMount(() => { const t = setInterval(() => beat++, 500); return () => clearInterval(t); });

  const counts = $derived(fleetCounts(sessions, agents));
  const live = $derived.by(() => {
    const q = splitQueue(queueOf(sessions, agents));
    return { ...q, choices: q.hero ? heroChoices(q.hero, agents[q.hero.key], now) : [] };
  });
  const view = $derived.by(() => { beat; return settle.view(live, Date.now()); });
  const connected = $derived(new Set(servers.filter((s) => s.state === 'connected').map((s) => s.id)));
  const cont = $derived(continueTarget(lastKey, sessions, connected, [...(view.hero ? [view.hero] : []), ...view.rest]));
  const filtered = $derived(filter ? sessions.map((s) => rowOf(s, agents[s.key])).filter((r) => r.state === filter) : []);
  const KIND_WORD = { needs_input: 'waiting', failed: 'failed', finished_unseen: 'finished' } as const;

  const meta = (r: Row) => [r.serverName, r.kind && r.since ? `${KIND_WORD[r.kind]} ${ageText(r.since, now)}` : ''].filter(Boolean).join(' · ');
  const detach = (id: number) => settle.touchUp(id);
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" data-home
  onpointerdowncapture={(e) => settle.touchDown(e.pointerId)} onpointerupcapture={(e) => detach(e.pointerId)} onpointercancelcapture={(e) => detach(e.pointerId)}
  onscroll={() => settle.scrolled(Date.now())}>
  <h1 class="sr-only">Home</h1>

  {#if servers.length === 0}
    <EmptyState title="No servers yet" body="Add a server and its agents will gather here.">
      <button type="button" onclick={onservers} class="min-h-11 rounded-card bg-accent px-4 text-base font-semibold text-on-accent">Add a server</button>
    </EmptyState>
  {:else}
    <div class="grid grid-cols-4 gap-2" role="group" aria-label="Fleet" data-home-tiles>
      {#each FILTERS as f (f)}
        <FleetTile state={f} count={counts[f]} pressed={filter === f} onclick={() => (filter = filter === f ? null : f)} />
      {/each}
    </div>

    {#if filter}
      <section class="flex flex-col gap-2" aria-label="Filtered sessions" data-home-filter>
        {#each filtered as r (r.key)}
          <QueueItem name={r.name} summary={r.title} meta={meta(r)} state={r.state} agent={r.agent} onclick={() => onopen(r.key)} />
        {:else}
          <p class="py-6 text-center text-base text-soft">No sessions in this state.</p>
        {/each}
      </section>
    {:else}
      {#if view.hero}
        {@const h = view.hero}
        <DecisionCard agent={h.agent} session={h.name} waited={h.since ? ageText(h.since, now) : undefined} context={[h.serverName, h.title].filter(Boolean).join(' · ')} question={h.question ?? 'Needs your answer'}>
          {#if view.choices.length && h.prompt}
            {@const prompt = h.prompt}
            <div class="flex flex-col gap-2" data-hero-options>
              {#each view.choices as c, i (i)}
                <OptionButton hint={String(i + 1)} label={c} primary={i === 0} onclick={() => onanswer(h.key, i, prompt)} />
              {/each}
            </div>
          {/if}
          <button type="button" onclick={() => onopen(h.key)} class="min-h-11 rounded-card bg-raised px-4 text-base font-semibold text-fg">Open session</button>
        </DecisionCard>
      {/if}

      {#if view.rest.length}
        <section class="flex flex-col gap-2" aria-label="Queue" data-home-queue>
          {#each view.rest as r (r.key)}
            <QueueItem name={r.name} summary={r.title} meta={meta(r)} state={r.state} agent={r.agent} onclick={() => onopen(r.key)} />
          {/each}
        </section>
      {/if}

      {#if cont}
        <section class="flex flex-col gap-2" aria-label="Continue" data-home-continue>
          <h2 class="text-sm font-semibold text-soft">Continue</h2>
          <QueueItem name={cont.name} meta={`${cont.serverName} · last used`} state={rowOf(cont, agents[cont.key]).state} agent={agents[cont.key]?.agent} onclick={() => onopen(cont.key)} />
        </section>
      {:else if !view.hero && !view.rest.length}
        {#if sessions.length === 0}
          <EmptyState title="No sessions yet" body="Start one and it shows up here.">
            <button type="button" onclick={() => onnew()} class="min-h-11 rounded-card bg-accent px-4 text-base font-semibold text-on-accent">Start a session</button>
          </EmptyState>
        {:else}
          <EmptyState title="All quiet" body="Nothing needs you right now." />
        {/if}
      {/if}
    {/if}
  {/if}
</div>
