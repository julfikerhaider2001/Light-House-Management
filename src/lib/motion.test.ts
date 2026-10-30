import { describe, expect, it } from 'vitest';
import { project, rubberband, VelocityTracker } from './motion';

describe('motion helpers', () => {
  it('rubber-bands with growing resistance and keeps the sign', () => {
    const small = rubberband(20, 300);
    const large = rubberband(200, 300);
    expect(small).toBeLessThan(20);
    expect(large / 200).toBeLessThan(small / 20);
    expect(rubberband(-50, 300)).toBeCloseTo(-rubberband(50, 300));
  });

  it('projects a flick forward', () => {
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(0)).toBe(0);
  });

  it('measures velocity from recent samples', () => {
    const v = new VelocityTracker();
    v.add(0, 0);
    v.add(10, 10);
    v.add(30, 20);
    expect(v.velocity()).toBeCloseTo(1500);
    v.reset();
    expect(v.velocity()).toBe(0);
  });
});
