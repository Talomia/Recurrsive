'use client';
import { useState, useCallback, useId, useEffect } from 'react';
import Header from "@/components/header";
import { Globe, Bell, Shield, Palette, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSettingsSections } from '@/lib/api';
import type { SettingsSection, SettingsField } from '@/lib/api';
import { apiFetch } from '@/lib/api/client';

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
  const [error, setError] = useState<string | null>(null);

  // Load setting section definitions AND the current server-persisted values.
  // Values come from the server (GET /api/v1/config → data.settings) — never
  // from localStorage. A 503 (server not initialized) falls back to the section
  // defaults, which are the server's own defaults.
  useEffect(() => {
    (async () => {
      try {
        const s = await getSettingsSections();
        setSections(s);
        const defaults = buildDefaults(s);
        let serverValues: Record<string, unknown> = {};
        try {
          const cfg = await apiFetch<{ settings?: Record<string, unknown> }>('/api/v1/config');
          serverValues = cfg?.settings ?? {};
        } catch {
          // Server not initialized / unreachable — show defaults (still editable).
        }
        const merged: Record<string, string | boolean> = { ...defaults };
        for (const key of Object.keys(defaults)) {
          if (key in serverValues && serverValues[key] != null) {
            const v = serverValues[key];
            merged[key] = typeof v === 'boolean' ? v : String(v);
          }
        }
        setValues(merged);
      } catch {
        setError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = useCallback((key: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    // Coerce number-typed fields to real numbers for the PATCH schema.
    const numberKeys = new Set(
      sections.flatMap((s) => s.settings.filter((f) => f.type === 'number').map((f) => f.key)),
    );
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      payload[k] = numberKeys.has(k) && typeof v === 'string' ? Number(v) : v;
    }
    try {
      await apiFetch('/api/v1/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        unwrap: false,
      });
      // Only claim success after the server actually accepts the change.
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? `Failed to save settings: ${err.message}` : 'Failed to save settings.');
    }
  }, [values, sections]);

  const handleReset = useCallback(() => {
    setValues(buildDefaults(sections));
    setSaved(false);
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
        {error && (
          <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <span className="text-sm text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300">Dismiss</button>
          </div>
        )}
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
