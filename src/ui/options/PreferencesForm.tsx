import {
  ALLERGENS,
  ALLERGEN_LABELS,
  DIETARY_LABELS,
  DIETARY_PREFERENCES,
  type Allergen,
  type DietaryPreference,
  type Preferences,
} from '../../storage/preferences';

export interface PreferencesFormProps {
  preferences: Preferences;
  update: (changes: Partial<Preferences>) => Promise<void>;
}

function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Shopping preferences. All values stay in chrome.storage.local on this device. */
export function PreferencesForm({ preferences, update }: PreferencesFormProps) {
  return (
    <div className="wi-stack">
      <fieldset className="wi-fieldset">
        <legend>Checkout review</legend>
        <label className="wi-check">
          <input
            type="checkbox"
            checked={preferences.promptsEnabled}
            onChange={(event) => void update({ promptsEnabled: event.target.checked })}
          />
          <span>
            <strong>Show checkout prompts</strong>
            <span className="wi-hint">
              When off, Worth It still reviews your cart but only shows the small “Reviewed N items” indicator.
            </span>
          </span>
        </label>
        <label className="wi-check">
          <input
            type="checkbox"
            checked={preferences.investmentIllustration}
            onChange={(event) => void update({ investmentIllustration: event.target.checked })}
          />
          <span>
            <strong>Show the investment illustration</strong>
            <span className="wi-hint">
              One hypothetical line at the end of the recap: what the cart’s total potential savings could grow to at an
              assumed 10% yearly return over 40 years (before inflation; not guaranteed).
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="wi-fieldset">
        <legend>Purchase recording</legend>
        <label className="wi-check">
          <input
            type="checkbox"
            checked={preferences.recordPurchases}
            onChange={(event) => void update({ recordPurchases: event.target.checked })}
          />
          <span>
            <strong>Offer to record purchases from Walmart and Amazon order pages</strong>
            <span className="wi-hint">
              On the order confirmation and purchase-history pages, Worth It offers to read item names, quantities, and
              prices so you can save them. It never reads payment, address, or account details, and you review every
              item before saving.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="wi-fieldset">
        <legend>Allergies (used only to flag conflicts with a suggested product)</legend>
        <div className="wi-chips">
          {ALLERGENS.map((allergen: Allergen) => (
            <label key={allergen} className="wi-chip">
              <input
                type="checkbox"
                checked={preferences.allergens.includes(allergen)}
                onChange={() => void update({ allergens: toggleIn(preferences.allergens, allergen) })}
              />
              <span>{ALLERGEN_LABELS[allergen]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="wi-fieldset">
        <legend>Dietary preferences</legend>
        <div className="wi-chips">
          {DIETARY_PREFERENCES.map((preference: DietaryPreference) => (
            <label key={preference} className="wi-chip">
              <input
                type="checkbox"
                checked={preferences.dietaryPreferences.includes(preference)}
                onChange={() =>
                  void update({ dietaryPreferences: toggleIn(preferences.dietaryPreferences, preference) })
                }
              />
              <span>{DIETARY_LABELS[preference]}</span>
            </label>
          ))}
        </div>
        <p className="wi-hint">Allergies and dietary preferences stay on this device and are never sent to OpenAI.</p>
      </fieldset>
    </div>
  );
}
