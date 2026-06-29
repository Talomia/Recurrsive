import Header from "@/components/header";
import { Settings as SettingsIcon, Globe, Bell, Shield, Palette, Code2, Database } from "lucide-react";

const SECTIONS = [
  {
    icon: Globe,
    title: "API Connection",
    description: "Configure the Recurrsive API server endpoint",
    settings: [
      { label: "API Base URL", value: "http://localhost:3000", type: "text" as const },
      { label: "API Key", value: "••••••••••••••••", type: "password" as const },
    ],
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Configure alert thresholds and notification preferences",
    settings: [
      { label: "Health Score Alert Threshold", value: "70", type: "number" as const },
      { label: "Email Notifications", value: "enabled", type: "toggle" as const },
    ],
  },
  {
    icon: Shield,
    title: "Security",
    description: "Security scanning and vulnerability detection settings",
    settings: [
      { label: "Auto-scan on Push", value: "enabled", type: "toggle" as const },
      { label: "CVE Alert Level", value: "High", type: "text" as const },
    ],
  },
  {
    icon: Palette,
    title: "Appearance",
    description: "Customize dashboard look and feel",
    settings: [
      { label: "Theme", value: "Dark", type: "text" as const },
      { label: "Compact Mode", value: "disabled", type: "toggle" as const },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" subtitle="Configure your Recurrsive dashboard" />
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        {SECTIONS.map((section, i) => {
          const Icon = section.icon;
          return (
            <div key={i} className="glass-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                  <Icon className="h-4.5 w-4.5 text-text-secondary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
                  <p className="text-xs text-text-muted">{section.description}</p>
                </div>
              </div>
              <div className="space-y-3 pl-12">
                {section.settings.map((setting, j) => (
                  <div key={j} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-text-secondary">{setting.label}</label>
                    {setting.type === "toggle" ? (
                      <div className={`relative h-6 w-11 rounded-full transition-colors ${setting.value === "enabled" ? "bg-accent-blue" : "bg-white/10"}`}>
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${setting.value === "enabled" ? "left-5.5" : "left-0.5"}`} />
                      </div>
                    ) : (
                      <input
                        type={setting.type}
                        defaultValue={setting.value}
                        className="rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue/40 transition-colors w-64 text-right"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end gap-3">
          <button className="rounded-xl bg-white/5 border border-white/5 px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/8 transition-colors">
            Reset to Defaults
          </button>
          <button className="rounded-xl bg-accent-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
