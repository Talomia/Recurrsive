export default function Loading() {
  return (
    <div
      style={{
        paddingTop: 'var(--nav-height)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
      }}
    >
      {/* Scoped keyframes */}
      <style>{`
        @keyframes recurrsive-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* Pulsing logo */}
      <div
        style={{
          animation: 'recurrsive-pulse 2s ease-in-out infinite',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-lg)',
        }}
      >
        <span
          className="text-gradient"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          recurrsive
        </span>
      </div>

      {/* Shimmer bar */}
      <div
        style={{
          width: 120,
          height: 3,
          borderRadius: 'var(--radius-full)',
          background: 'var(--border-subtle)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '50%',
            borderRadius: 'var(--radius-full)',
            background: 'var(--gradient-brand)',
            animation: 'loading-bar 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}
