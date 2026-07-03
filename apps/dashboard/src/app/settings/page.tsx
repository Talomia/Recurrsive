'use client';
import { useState, useCallback, useId, useEffect } from 'react';
import Header from "@/components/header";
import { Globe, Bell, Shield, Palette, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSettingsSections } from '@/lib/api';
import type { SettingsSection, SettingsField } from '@/lib/api';

// ---------------------------------------------------------------------------
// Icon map — resolve icon name strings from the API to Lucide components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = { Globe, Bell, Shield, Palette };

// ---------------------------------------------------------------------------
// Defaults map
// ---------------------------------------------------------------------------

function buildDefaults(sections: SettingsSection[]): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = {};
  for (const section of sections) {
    for (const setting of section.settings) {
      defaults[setting.key] = setting.defaultValue;
    }
  }
  return defaults;
}

// ---------------------------------------------------------------------------
// Toggle component (accessible)
// ---------------------------------------------------------------------------

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue ${
        checked ? 'bg-accent-blue' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'left-[1.375rem]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const baseId = useId();
  const [sections, setSections] = useState<SettingsSection[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings sections from API (pure mock fallback)
  useEffect(() => {
    getSettingsSections()
      .then((s) => {
        setSections(s);
        setValues(buildDefaults(s));
      })
      .finally(() => setLoading(false));
  }, []);

  // Hydrate from localStorage on mount (after sections are loaded)
  useEffect(() => {
    if (sections.length === 0) return;
    try {
      const stored = localStorage.getItem('recurrsive-settings');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string | boolean>;
        setValues((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // localStorage unavailable or corrupt — use defaults
    }
  }, [sections]);

  const handleChange = useCallback((key: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    // In production, this would POST to the API.
    // For now, persist to localStorage.
    try {
      localStorage.setItem('recurrsive-settings', JSON.stringify(values));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // localStorage unavailable (e.g. SSR) — no-op
    }
  }, [values]);

  const handleReset = useCallback(() => {
    setValues(buildDefaults(sections));
    setSaved(false);
    try {
      localStorage.removeItem('recurrsive-settings');
    } catch {
      // no-op
    }
  }, [sections]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Settings" subtitle="Configure your Recurrsive dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" subtitle="Configure your Recurrsive dashboard" />
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        {sections.map((section, i) => {
          const Icon = ICON_MAP[section.icon] ?? Globe;
          return (
            <fieldset
              key={section.title}
              className="glass-card p-5 space-y-4 border-0"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <legend className="sr-only">{section.title}</legend>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                  <Icon className="h-4.5 w-4.5 text-text-secondary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
                  <p className="text-xs text-text-muted">{section.description}</p>
                </div>
              </div>
              <div className="space-y-3 pl-12">
                {section.settings.map((setting: SettingsField) => {
                  const inputId = `${baseId}-${setting.key}`;
                  return (
                    <div key={setting.key} className="flex items-center justify-between gap-4">
                      <label htmlFor={inputId} className="text-sm text-text-secondary">
                        {setting.label}
                      </label>
                      {setting.type === 'toggle' ? (
                        <Toggle
                          id={inputId}
                          checked={values[setting.key] as boolean}
                          onChange={(v) => handleChange(setting.key, v)}
                          label={setting.label}
                        />
                      ) : (
                        <input
                          id={inputId}
                          type={setting.type}
                          value={values[setting.key] as string}
                          onChange={(e) => handleChange(setting.key, e.target.value)}
                          className="rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue/40 transition-colors w-64 text-right"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="flex justify-end gap-3">
          <button
            onClick={handleReset}
            className="rounded-xl bg-white/5 border border-white/5 px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/8 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-accent-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
