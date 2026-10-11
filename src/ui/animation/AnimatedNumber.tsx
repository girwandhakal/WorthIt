import { formatCents } from '../../shared/currency';
import { useTween } from './motion';

/** A dollar amount that counts up to `cents`. Shows the exact amount once done (or at once without animation). */
export function AnimatedNumber({ cents, className, durationMs = 900, delayMs = 0, animate = true }: { cents: number; className?: string; durationMs?: number; delayMs?: number; animate?: boolean }) {
  const progress = useTween(durationMs, { delayMs, animate });
  return <span className={className}>{formatCents(progress >= 1 ? cents : Math.round(cents * progress))}</span>;
}
