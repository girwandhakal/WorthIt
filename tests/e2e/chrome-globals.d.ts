/**
 * The few `chrome.*` APIs e2e tests touch from inside extension contexts
 * (service worker and extension pages). Typed narrowly on purpose.
 */
declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  identity: object;
};
