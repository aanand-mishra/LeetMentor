import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const TestComponent = ({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) => {
  useKeyboardShortcuts({
    onOpenShortcuts: onOpen,
    onCloseModal: onClose,
  });

  return (
    <div>
      <input id="search-input" data-testid="search-input" />
      <input data-testid="regular-input" />
    </div>
  );
};

describe('NFR-9 — Keyboard Shortcuts', () => {
  it('triggers ? for shortcuts modal and / for search focus, suppressing letters while typing in input', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();

    render(
      <BrowserRouter>
        <TestComponent onOpen={onOpen} onClose={onClose} />
      </BrowserRouter>
    );

    const searchInput = screen.getByTestId('search-input');
    const regularInput = screen.getByTestId('regular-input');

    // Press '?' outside input
    fireEvent.keyDown(window, { key: '?' });
    expect(onOpen).toHaveBeenCalledTimes(1);

    // Press '/' outside input -> focuses searchInput
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(searchInput);

    // Inside regular input, typing '?' or 'n' is suppressed
    regularInput.focus();
    fireEvent.keyDown(regularInput, { key: '?' });
    expect(onOpen).toHaveBeenCalledTimes(1); // Not called again

    // Esc inside input still works
    fireEvent.keyDown(regularInput, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
