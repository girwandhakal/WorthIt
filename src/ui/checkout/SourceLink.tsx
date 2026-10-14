import type { Source } from '../../assessment/evidence/sources';

/** A source's name, linked to it when it has a page to open. */
export function SourceLink({ source }: { source: Source }) {
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer noopener">
      {source.label}
    </a>
  ) : (
    <>{source.label}</>
  );
}
