'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Monitor, MessageSquare, Globe } from 'lucide-react';
import { testNotificationChannel } from '@/lib/api';
import type { NotificationChannel } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const CHANNEL_ICONS: Record<string, typeof Monitor> = {
  console: Monitor,
  slack: MessageSquare,
  http: Globe,
};

export function ChannelCard({ channel }: { channel: NotificationChannel }) {
  const router = useRouter();
  const { user } = useAuth();
  const canTest = user?.role === 'admin';
  const Icon = CHANNEL_ICONS[channel.type] ?? Globe;
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await testNotificationChannel(channel.type);
      setResult({ ok: true, message: res.message ?? 'Test sent successfully' });
      router.refresh();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15 hover:bg-white/[0.04]">
      <div className="flex flex-col gap-4 p-5">
        {/* Icon + Status */}
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl ${
              channel.enabled ? "bg-green-500/10" : "bg-white/5"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                channel.enabled ? "text-green-400" : "text-text-muted"
              }`}
            />
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
              channel.enabled
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-white/5 text-text-muted border-white/10"
            }`}
          >
            {channel.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* Name + Description */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {channel.name}
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
            {channel.description}
          </p>
        </div>

        {/* Test button */}
        {canTest && channel.enabled ? (
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors w-full disabled:opacity-40"
            title={`Send test notification via ${channel.name}`}
          >
            <Send className="h-3.5 w-3.5" />
            {testing ? 'Sending…' : 'Test'}
          </button>
        ) : (
          <p className="text-[11px] text-text-muted text-center">
            {canTest ? 'Configure this channel before testing.' : 'Administrator access is required to send tests.'}
          </p>
        )}

        {/* Result feedback */}
        {result && (
          <p className={`text-[11px] font-medium text-center ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}
