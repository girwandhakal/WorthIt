import { useEffect, useState } from 'react';

export type Ease = (t: number) => number;

const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Eased progress from 0 to 1 over `durationMs`, starting after `delayMs`.
 * Without animation (reduced motion, static view) it is 1 from the start.
 */
export function useTween(durationMs: number, { delayMs = 0, animate = true, ease = easeOutCubic }: { delayMs?: number; animate?: boolean; ease?: Ease } = {}): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!animate) return;
    // Date.now (not the frame timestamp) so the tween follows the same clock as the recap's timers.
    const start = Date.now() + delayMs;
    if (typeof requestAnimationFrame !== 'function') {
      const timer = setTimeout(() => setProgress(1), delayMs + durationMs);
      return () => clearTimeout(timer);
    }
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / durationMs));
      setProgress(ease(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, delayMs, animate, ease]);
  return animate ? progress : 1;
}
