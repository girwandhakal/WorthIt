import { useEffect, useState } from 'react';
import { GmailImport } from './GmailImport';
import { HistoryView } from './HistoryView';
import { OpenAiSettings } from './OpenAiSettings';
import { PreferencesForm } from './PreferencesForm';
import { PrivacySummary, ResetAllData } from './PrivacyView';
import { ServicesContext, usePreferences, type OptionsServices } from './context';

const TABS = [
  { id: 'preferences', label: 'Preferences' },
  { id: 'history', label: 'Purchase history' },
  { id: 'gmail', label: 'Import from Gmail' },
  { id: 'openai', label: 'Wording assistant' },
  { id: 'privacy', label: 'Privacy' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const tabFromHash = (): TabId => {
  const hash = window.location.hash.slice(1);
  return TABS.some((tab) => tab.id === hash) ? (hash as TabId) : 'preferences';
};

export function OptionsApp({ services }: { services: OptionsServices }) {
  return (
    <ServicesContext.Provider value={services}>
      <OptionsShell />
    </ServicesContext.Provider>
  );
}

function OptionsShell() {
  const { preferences, loaded, update } = usePreferences();
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!loaded) return null;

  if (!preferences.onboardingComplete) {
    return (
      <main className="wi-page">
        <h1>Welcome to Worth It</h1>
        <p className="wi-lead-text">
          Worth It reviews your Walmart or Amazon cart before checkout and points out a few things worth a second thought: a cheaper
          store brand, something you bought recently, or an item with added sugar. It only suggests; you make every cart
          change.
        </p>
        <PrivacySummary />
        <h2>Choose your settings</h2>
        <PreferencesForm preferences={preferences} update={update} />
        <div className="wi-card">
          <h3>Optional extras</h3>
          <p>
            You can import receipts from Gmail and add an OpenAI key for more natural wording later in settings. Neither is
            required.
          </p>
        </div>
        <button type="button" className="wi-button wi-button-large" onClick={() => void update({ onboardingComplete: true })}>
          Finish setup
        </button>
      </main>
    );
  }

  return (
    <main className="wi-page">
      <h1>Worth It settings</h1>
      <nav className="wi-tabs" aria-label="Settings sections">
        {TABS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={item.id === tab ? 'wi-tab wi-tab-active' : 'wi-tab'}
            aria-current={item.id === tab ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <section aria-label={TABS.find((item) => item.id === tab)?.label}>
        {tab === 'preferences' && <PreferencesForm preferences={preferences} update={update} />}
        {tab === 'history' && <HistoryView />}
        {tab === 'gmail' && <GmailImport />}
        {tab === 'openai' && <OpenAiSettings />}
        {tab === 'privacy' && (
          <div className="wi-stack">
            <PrivacySummary />
            <ResetAllData />
          </div>
        )}
      </section>
    </main>
  );
}
