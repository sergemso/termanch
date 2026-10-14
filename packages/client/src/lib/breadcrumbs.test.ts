import { beforeEach, describe, expect, it } from 'vitest';
import { crumb, crumbText, resetCrumbs } from './breadcrumbs';

describe('breadcrumbs', () => {
  beforeEach(resetCrumbs);
  it('lists steps in order with their age', () => {
    crumb('open tab', 1000);
    crumb('open sheet', 4000);
    expect(crumbText(6000)).toEqual(['1. open tab (5 s ago)', '2. open sheet (2 s ago)']);
  });
  it('folds a burst of the same event and keeps only the last 30', () => {
    crumb('resize 40x20', 1000);
    crumb('resize 40x20', 1500);
    expect(crumbText(1500)).toHaveLength(1);
    for (let i = 0; i < 40; i++) crumb(`step ${i}`, 10000 + i * 2000);
    expect(crumbText(200000)).toHaveLength(30);
    expect(crumbText(200000)[29]).toContain('step 39');
  });
});
