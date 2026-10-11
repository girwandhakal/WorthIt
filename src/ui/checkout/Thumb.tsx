import { useState, type CSSProperties } from 'react';
import { SceneIcon, type IconKind } from '../animation/icons';
import { sizedImage } from './verdict';

const PX = { sm: 96, md: 160, lg: 480 } as const;

/**
 * The retailer's own product thumbnail, decorative (the name is always in text
 * next to it). Falls back to an illustration when there is no image or it fails.
 */
export function Thumb({
  src,
  kind,
  initial,
  size = 'md',
  className = '',
  style,
}: {
  src: string | null;
  kind: IconKind;
  /** Without an image, show this name's first letter instead of the illustration. */
  initial?: string;
  size?: keyof typeof PX;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : sizedImage(src, PX[size]);
  return (
    <span className={`wi-thumb wi-thumb-${size} ${url ? '' : 'wi-thumb-empty'} ${className}`} style={style} aria-hidden="true">
      {url ? (
        <img src={url} alt="" decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : initial ? (
        <span className="wi-thumb-initial">{initial.trim().charAt(0).toUpperCase()}</span>
      ) : (
        <SceneIcon kind={kind} />
      )}
    </span>
  );
}
