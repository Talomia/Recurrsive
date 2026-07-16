/**
 * Tests for the shared Toast provider + useToast hook.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../components/ui/toast';

function Trigger() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast('Saved successfully', 'success')}>fire</button>
  );
}

describe('ToastProvider / useToast', () => {
  it('shows a toast when triggered', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => { fireEvent.click(screen.getByText('fire')); });
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('dismisses a toast when the close button is clicked', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => { fireEvent.click(screen.getByText('fire')); });
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });

  it('throws when used outside a provider', () => {
    function Bad() {
      useToast();
      return null;
    }
    // Silence the expected React error boundary logging noise.
    const spy = console.error;
    console.error = () => {};
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    console.error = spy;
  });
});
