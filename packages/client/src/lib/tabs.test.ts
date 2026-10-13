import { describe, expect, it } from 'vitest';
import { FrozenOrder } from './cards';
import { tabIds, tabLabel, needsYouCount } from './tabs';
import type { AgentMap, SessionAgent } from './agents';
import type { HubSession } from './hub';

const session = (serverId: string, id: string): HubSession => ({ id, name: id, agent: null, serverId, serverName: `Host ${serverId}`, key: `${serverId}/${id}` });
const state = (state: SessionAgent['state']): SessionAgent => ({ state, seq: 1, ts: 0, stale: false });
const sessions = [session('a', 'one'), session('b', 'two'), session('b', 'three')];
const agents: AgentMap = { 'a/one': state('idle'), 'b/two': state('working'), 'b/three': state('needs_input') };

describe('tabs', () => {
  it('puts needs-you tabs first while preserving the order of everything else', () => {
    expect(tabIds(sessions, agents)).toEqual(['b/three', 'a/one', 'b/two']);
    expect(needsYouCount({ ...agents, 'c/error': state('error') })).toBe(2);
  });
  it('freezes state changes, inserts and removals during touch and for two seconds after scroll', () => {
    const frozen = new FrozenOrder();
    const first = tabIds(sessions, agents);
    expect(frozen.order(first, {}, 0)).toEqual(first);
    frozen.touchDown();
    const next = tabIds([sessions[1], session('c', 'new')], { 'c/new': state('needs_input') });
    expect(frozen.order(next, {}, 1)).toEqual(first);
    frozen.touchUp(); frozen.scrolled(100);
    expect(frozen.order(next, {}, 2099)).toEqual(first);
    expect(frozen.order(next, {}, 2100)).toEqual(next);
  });
  it('names the server only for multiple saved servers and always includes an accessible state word', () => {
    expect(tabLabel(sessions[0], agents['a/one'], 1, 0)).toBe('one · Idle');
    expect(tabLabel(sessions[2], agents['b/three'], 3, 0)).toBe('three · Host b · Needs you');
    expect(tabLabel(sessions[0], undefined, 2, 0)).toBe('one · Host a · No status');
  });
});
