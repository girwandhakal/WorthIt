import type { ReactElement } from 'react';
import type { ReviewFinding } from '../../domain/review';

/** Small inline illustrations for recap scenes. Decorative only (aria-hidden). */

type IconKind = ReviewFinding['kind'] | 'opening' | 'grouped' | 'closing';

export function SceneIcon({ kind }: { kind: IconKind }) {
  return (
    <svg className={`wi-scene-icon wi-scene-icon-${kind}`} viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" className="wi-icon-bg" />
      {ICONS[kind]}
    </svg>
  );
}

const stroke = { fill: 'none', strokeWidth: 3.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'wi-icon-line' };

const ICONS: Record<IconKind, ReactElement> = {
  // A pause: two bars.
  opening: (
    <g {...stroke}>
      <line x1="26" y1="22" x2="26" y2="42" />
      <line x1="38" y1="22" x2="38" y2="42" />
    </g>
  ),
  // Two arrows chasing: a repeat.
  skip_redundant: (
    <g {...stroke}>
      <path d="M20 28a13 13 0 0 1 23-6" />
      <polyline points="44 15 44 23 36 23" />
      <path d="M44 36a13 13 0 0 1-23 6" />
      <polyline points="20 49 20 41 28 41" />
    </g>
  ),
  repeat_question: (
    <g {...stroke}>
      <path d="M25 25a7 7 0 1 1 10 6c-2 1-3 3-3 5" />
      <line x1="32" y1="44" x2="32" y2="44.5" />
    </g>
  ),
  // A sparkle: novelty.
  skip_novelty: (
    <g {...stroke}>
      <path d="M32 16l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" />
    </g>
  ),
  // A sugar cube.
  reduce_added_sugar: (
    <g {...stroke}>
      <path d="M20 26l12-7 12 7v14l-12 7-12-7z" />
      <path d="M20 26l12 7 12-7M32 33v14" />
    </g>
  ),
  // A leaf-and-label: ingredients and nutrition.
  reduce_food_concern: (
    <g {...stroke}>
      <path d="M22 20h20v26a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4z" />
      <line x1="27" y1="28" x2="37" y2="28" />
      <line x1="27" y1="34" x2="37" y2="34" />
      <line x1="27" y1="40" x2="33" y2="40" />
    </g>
  ),
  // A price tag.
  cheaper_alternative: (
    <g {...stroke}>
      <path d="M18 32V20h12l16 16-12 12z" />
      <circle cx="25" cy="27" r="2" />
    </g>
  ),
  store_brand_note: (
    <g {...stroke}>
      <path d="M18 32V20h12l16 16-12 12z" />
    </g>
  ),
  uncertain: (
    <g {...stroke}>
      <circle cx="32" cy="32" r="13" />
      <line x1="32" y1="25" x2="32" y2="34" />
      <line x1="32" y1="39" x2="32" y2="39.5" />
    </g>
  ),
  grouped: (
    <g {...stroke}>
      <rect x="18" y="20" width="28" height="7" rx="3" />
      <rect x="18" y="31" width="28" height="7" rx="3" />
      <rect x="18" y="42" width="18" height="5" rx="2.5" />
    </g>
  ),
  // A seedling: growth over time.
  closing: (
    <g {...stroke}>
      <path d="M32 48V30" />
      <path d="M32 34c-9 0-13-6-13-12 8 0 13 4 13 12z" />
      <path d="M32 30c0-8 5-12 13-12 0 7-4 12-13 12z" />
      <line x1="22" y1="48" x2="42" y2="48" />
    </g>
  ),
};
