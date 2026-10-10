import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  clearOpenAiKey,
  getOpenAiKey,
  getPreferences,
  maskKey,
  setOpenAiKey,
  updatePreferences,
} from '../../src/storage/preferences';
import { memoryArea } from '../helpers/background';

const KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123';

describe('preferences', () => {
  it('defaults: prompts on, recording off (opt-in), investment illustration on', async () => {
    expect(await getPreferences(memoryArea())).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toMatchObject({ promptsEnabled: true, recordPurchases: false, investmentIllustration: true });
  });

  it('updates and persists, and fills defaults for settings added later', async () => {
    const area = memoryArea();
    await updatePreferences(area, { recordPurchases: true, allergens: ['peanuts'] });
    expect(await getPreferences(area)).toMatchObject({ recordPurchases: true, allergens: ['peanuts'], promptsEnabled: true });

    area.data.set('preferences', { onboardingComplete: true });
    expect(await getPreferences(area)).toEqual({ ...DEFAULT_PREFERENCES, onboardingComplete: true });
  });

  it('rejects invalid values and falls back to defaults for corrupt storage', async () => {
    const area = memoryArea();
    await expect(updatePreferences(area, { allergens: ['gluten' as never] })).rejects.toThrow();
    area.data.set('preferences', { promptsEnabled: 'yes' });
    expect(await getPreferences(area)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('OpenAI key', () => {
  it('is stored separately, masked for display, and clearable', async () => {
    const area = memoryArea();
    await setOpenAiKey(area, `  ${KEY} `);
    expect(await getOpenAiKey(area)).toBe(KEY);
    expect(maskKey(KEY)).toBe('sk-…0123');
    expect(await getPreferences(area)).not.toHaveProperty('openaiApiKey');
    await clearOpenAiKey(area);
    expect(await getOpenAiKey(area)).toBeNull();
  });

  it('rejects values that are not API keys', async () => {
    await expect(setOpenAiKey(memoryArea(), 'hello')).rejects.toThrow(/sk-/);
  });
});
