/**
 * @module LiveIndicator
 *
 * Visual indicator component showing real-time WebSocket connection status.
 * Displays a pulsing dot with status text and optional client count.
 *
 * @packageDocumentation
 */

'use client';

import type { ConnectionStatus } from '../hooks/useWebSocket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveIndicatorProps {
  /** Current WebSocket connection status. */
  status: ConnectionStatus;
  /** Number of connected clients (optional). */
  clientCount?: number;
  /** Whether to show client count. Defaults to false. */
  showClientCount?: boolean;
  /** Size variant. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const statusConfig: Record<
  ConnectionStatus,
  { color: string; pulseColor: string; label: string }
> = {
  connected: {
    color: '#22c55e',
    pulseColor: 'rgba(34, 197, 94, 0.4)',
    label: 'Live',
  },
  connecting: {
    color: '#f59e0b',
    pulseColor: 'rgba(245, 158, 11, 0.4)',
    label: 'Connecting',
  },
  reconnecting: {
    color: '#f59e0b',
    pulseColor: 'rgba(245, 158, 11, 0.4)',
    label: 'Reconnecting',
  },
  disconnected: {
    color: '#6b7280',
    pulseColor: 'rgba(107, 114, 128, 0.4)',
    label: 'Offline',
  },
};

const sizeConfig: Record<'sm' | 'md' | 'lg', { dot: number; font: string; gap: string }> = {
  sm: { dot: 6, font: '11px', gap: '4px' },
  md: { dot: 8, font: '12px', gap: '6px' },
  lg: { dot: 10, font: '14px', gap: '8px' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a live connection indicator with pulsing animation.
 *
 * @example
 * ```tsx
 * import { useWebSocket } from '../hooks/useWebSocket';
 * import { LiveIndicator } from './LiveIndicator';
 *
 * function Header() {
 *   const { status, clientCount } = useWebSocket();
 *   return <LiveIndicator status={status} clientCount={clientCount} showClientCount />;
 * }
 * ```
 */
export function LiveIndicator({
  status,
  clientCount = 0,
  showClientCount = false,
  size = 'md',
}: LiveIndicatorProps) {
  const config = statusConfig[status];
  const sizeConf = sizeConfig[size];
  const isActive = status === 'connected';
  const isPending = status === 'connecting' || status === 'reconnecting';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeConf.gap,
        padding: '4px 10px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        border: `1px solid ${config.color}33`,
        fontSize: sizeConf.font,
        fontWeight: 500,
        color: config.color,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Pulsing dot */}
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          width: `${sizeConf.dot}px`,
          height: `${sizeConf.dot}px`,
        }}
      >
        {/* Pulse ring (only when connected or pending) */}
        {(isActive || isPending) && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: config.pulseColor,
              animation: isActive
                ? 'live-pulse 2s ease-in-out infinite'
                : 'live-pulse 1s ease-in-out infinite',
            }}
          />
        )}
        {/* Solid dot */}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: config.color,
          }}
        />
      </span>

      {/* Status label */}
      <span>{config.label}</span>

      {/* Client count badge */}
      {showClientCount && isActive && clientCount > 0 && (
        <span
          style={{
            marginLeft: '2px',
            padding: '1px 5px',
            borderRadius: '9999px',
            backgroundColor: `${config.color}22`,
            fontSize: `calc(${sizeConf.font} - 1px)`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clientCount}
        </span>
      )}

      {/* Keyframe animation */}
      <style>{`
        @keyframes live-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
