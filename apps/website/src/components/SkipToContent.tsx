'use client';

/**
 * Skip-to-content accessibility link.
 * Visually hidden until focused (via Tab key), then slides into view.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.position = 'fixed';
        el.style.left = '16px';
        el.style.top = '16px';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.overflow = 'visible';
        el.style.zIndex = '99999';
        el.style.padding = '12px 24px';
        el.style.background = '#6366f1';
        el.style.color = '#fff';
        el.style.borderRadius = '8px';
        el.style.fontSize = '14px';
        el.style.fontWeight = '600';
        el.style.textDecoration = 'none';
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.overflow = 'hidden';
      }}
    >
      Skip to main content
    </a>
  );
}
