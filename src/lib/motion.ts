// Interruptible springs (Apple's damping/response model) and gesture helpers.
// Springs always start from the current on-screen value and carry velocity, so a new
// target mid-flight never jumps.

export interface SpringOptions {
  /** 1 = critically damped (no overshoot); < 1 bounces. */
  damping?: number;
  /** Seconds to (roughly) reach the target. Not a duration. */
  response?: number;
  /** Initial velocity in units per second (e.g. the finger's release velocity). */
  velocity?: number;
}

export const SPRING_DEFAULT = { damping: 1, response: 0.35 } as const;
export const SPRING_SHEET = { damping: 0.8, response: 0.3 } as const;

export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export interface SpringHandle {
  stop(): void;
  /** Current value and velocity, for interrupting with a new spring. */
  readonly value: number;
  readonly velocity: number;
}

export function spring(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  opts: SpringOptions = {},
  onRest?: () => void,
): SpringHandle {
  const damping = opts.damping ?? SPRING_DEFAULT.damping;
  const response = opts.response ?? SPRING_DEFAULT.response;
  const stiffness = ((2 * Math.PI) / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;

  let x = from;
  let v = opts.velocity ?? 0;
  let frame = 0;
  let last = 0;

  const state = {
    stop: () => cancelAnimationFrame(frame),
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
  };

  if (prefersReducedMotion()) {
    x = to;
    v = 0;
    onUpdate(to);
    onRest?.();
    return state;
  }

  const step = (now: number) => {
    const dt = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 1 / 30);
    last = now;
    // Semi-implicit Euler in small substeps: stable for stiff springs.
    const sub = 4;
    for (let i = 0; i < sub; i++) {
      const h = dt / sub;
      v += (-stiffness * (x - to) - friction * v) * h;
      x += v * h;
    }
    if (Math.abs(v) < 0.5 && Math.abs(x - to) < 0.5) {
      x = to;
      v = 0;
      onUpdate(to);
      onRest?.();
      return;
    }
    onUpdate(x);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return state;
}

/** Progressive resistance past an edge (Apple's rubber-band curve). */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const sign = Math.sign(overshoot);
  const o = Math.abs(overshoot);
  return (sign * (o * dimension * constant)) / (dimension + constant * o);
}

/** Where a flick will come to rest (scroll-style exponential deceleration). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Velocity from the last ~80 ms of pointer samples, in px/s. */
export class VelocityTracker {
  private samples: { t: number; x: number }[] = [];

  add(x: number, t = performance.now()) {
    this.samples.push({ t, x });
    while (this.samples.length > 2 && t - (this.samples[0]?.t ?? t) > 80) this.samples.shift();
  }

  velocity(): number {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (!first || !last || last.t === first.t) return 0;
    return ((last.x - first.x) / (last.t - first.t)) * 1000;
  }

  reset() {
    this.samples = [];
  }
}
