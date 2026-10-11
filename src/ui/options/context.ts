import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_PREFERENCES, getPreferences, updatePreferences, type LocalArea, type Preferences } from '../../storage/preferences';
import type { Repositories } from '../../storage/repositories';
import type { IdentityApi } from '../../ingestion/gmail/oauth';
import type { FetchLike } from '../../ingestion/gmail/search-orders';

/** Everything the options UI needs from the browser, injectable for tests. */
export interface OptionsServices {
  local: LocalArea;
  repositories: () => Promise<Repositories>;
  identity: IdentityApi;
  fetch: FetchLike;
  gmailConfigured: boolean;
  /** This extension's ID, shown when Google rejects the sign-in so it can be compared with the OAuth client. */
  extensionId?: string;
  /** True in public builds that use the wording proxy (no key in the browser). */
  wordingProxy?: boolean;
  now: () => Date;
}

export const ServicesContext = createContext<OptionsServices | null>(null);

export function useServices(): OptionsServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('OptionsServices missing');
  return services;
}

export function usePreferences(): {
  preferences: Preferences;
  loaded: boolean;
  update: (changes: Partial<Preferences>) => Promise<void>;
} {
  const { local } = useServices();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPreferences(local).then((value) => {
      if (cancelled) return;
      setPreferences(value);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [local]);

  // Writes are read-modify-write on storage, so run them one at a time; the UI
  // updates immediately so controls never lag behind a click.
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const update = useCallback(
    (changes: Partial<Preferences>) => {
      setPreferences((current) => ({ ...current, ...changes }));
      const write = writes.current.then(() => updatePreferences(local, changes));
      writes.current = write.catch(() => undefined);
      return write.then(setPreferences);
    },
    [local],
  );

  return { preferences, loaded, update };
}

/** Parses "4.97", "$4.97", or "$1,234" into cents; empty means unknown. */
export function parseDollarInput(value: string): { cents: number | null; error: string | null } {
  const trimmed = value.trim().replace(/,/g, '');
  if (trimmed === '') return { cents: null, error: null };
  const match = /^\$?(\d{1,7})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return { cents: null, error: 'Enter a price like 4.97' };
  return { cents: Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')), error: null };
}
