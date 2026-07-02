/**
 * Tests for the LiveIndicator component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveIndicator } from '../../components/LiveIndicator';

describe('LiveIndicator', () => {
  it('shows "Live" when connected', () => {
    render(<LiveIndicator status="connected" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows "Connecting" when connecting', () => {
    render(<LiveIndicator status="connecting" />);
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  it('shows "Reconnecting" when reconnecting', () => {
    render(<LiveIndicator status="reconnecting" />);
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  it('shows "Offline" when disconnected', () => {
    render(<LiveIndicator status="disconnected" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows client count when connected and showClientCount is true', () => {
    render(
      <LiveIndicator status="connected" clientCount={5} showClientCount />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('hides client count when disconnected', () => {
    render(
      <LiveIndicator status="disconnected" clientCount={5} showClientCount />
    );
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('hides client count when showClientCount is false', () => {
    render(
      <LiveIndicator status="connected" clientCount={5} showClientCount={false} />
    );
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('hides client count when count is 0', () => {
    render(
      <LiveIndicator status="connected" clientCount={0} showClientCount />
    );
    // clientCount 0 should not show the badge
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
