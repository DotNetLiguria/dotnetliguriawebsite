import React, { useEffect, useState } from 'react';
import { useCan } from '../../account/PermissionGate';
import { LoadError, Panel, SwitchInput } from '../ui';
import { AdminApiError, useAdminFetch, useAdminLoad } from '../adminApi';
import { notify } from '../toasts';
import { HomePageSettings, homePageSettingsOf } from '../../site/siteApi';

const SECTIONS: { key: keyof HomePageSettings; label: string }[] = [
  { key: 'showProposeTalk', label: 'Proponi un talk' },
  { key: 'showFollowUs', label: 'Seguici' },
];

/** Shows or hides the optional cards at the bottom of the public home page. */
export default function HomeSectionsPanel() {
  const can = useCan();
  const api = useAdminFetch();
  const [load, reload] = useAdminLoad<unknown>('/HomePageSettings');
  const [settings, setSettings] = useState<HomePageSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (load.state === 'ready') setSettings(homePageSettingsOf(load.data));
  }, [load]);

  const toggle = async (key: keyof HomePageSettings, value: boolean) => {
    if (!settings || saving) return;
    const previous = settings;
    const next = { ...settings, [key]: value };
    const label = SECTIONS.find(section => section.key === key)!.label;
    setSettings(next);
    setSaving(true);
    try {
      await api('/HomePageSettings', { method: 'PUT', body: JSON.stringify(next) });
      notify(value ? 'Sezione mostrata nella home page' : 'Sezione nascosta dalla home page', { description: label });
    } catch (error) {
      setSettings(previous);
      notify('Modifica non riuscita', { description: error instanceof AdminApiError ? error.message : 'Errore di rete', kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="mt-6 p-5" labelledBy="home-sections-title">
      <h2 id="home-sections-title" className="text-lg font-bold">Sezioni della home page</h2>
      <p className="mt-1 text-sm text-muted">Scegli quali schede mostrare in fondo alla home page del sito.</p>
      {load.state === 'error' && <div className="mt-3"><LoadError message={`Le impostazioni non sono disponibili (${load.message}).`} onRetry={reload} /></div>}
      {load.state === 'loading' && !settings && <p role="status" className="mt-3 text-muted">Caricamento delle impostazioni…</p>}
      {settings && (
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
          {SECTIONS.map(section => (
            <SwitchInput
              key={section.key}
              isSelected={settings[section.key]}
              isDisabled={saving || !can('site-menu.manage')}
              onChange={value => toggle(section.key, value)}
            >
              Mostra «{section.label}»
            </SwitchInput>
          ))}
        </div>
      )}
    </Panel>
  );
}
